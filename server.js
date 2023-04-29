const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

let cryptoRandomString;
import('crypto-random-string').then((module) => {
  cryptoRandomString = module.default;
});

const mysql = require('mysql');
const nodemailer = require('nodemailer');



//all current clients
let clients = {};

//array of active canvases
let canvases = [];

//class to maintain canvases
class canvas {
  lock = false;
  users = [];
  objects = {};
  color = "white";
  constructor(code, creator) {
    this.code = code;
    this.users.push(creator);
    this.currentstate = "";
  }

  addClient(client) {
    this.users.push(client);
  }
  changeCurrent(state)
  {
    this.currentstate = state;
  }
  addObject(id, objectData) {
    this.objects[id] = objectData;
  }
  
  deleteObject(id) {
    delete this.objects[id];
  }
  
  modifyObject(id, objectData) {
    this.objects[id] = objectData;
  }

}

//db connection
function createMySQLConnection() {
  return mysql.createConnection({
    host: 'localhost', 
    user: 'root', 
    password: '', 
    database: 'freehand' 
  });
}


//sending email
async function sendEmail(to, subject, text) {

  const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
      user: 'kubko310@gmail.com',
      pass: 'tgmcdrapwtjjywxk'
    }
  });

  const mailOptions = {
    from: 'kubko310@gmail.com', 
    to: to, 
    subject: subject, 
    text: text 
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('Error occurred while sending email:', error);
  }
}


//url checker
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use(express.static(__dirname + '/public'));

app.get('/:code', (req, res) => {
  if (canvasExist(req.params.code)) {
    let tmpc =  getCanvas(req.params.code);

    if (tmpc.lock) {
      res.sendFile('nocanvas.html', { root: path.join(__dirname, 'public/') });
    }
    else
    {
      res.sendFile('index.html', { root: path.join(__dirname, 'public') });
    }
  }
  else
  {
    res.sendFile('nocanvas.html', { root: path.join(__dirname, 'public/') });
  }
});

const url = require('url');
const canvasCodeRegex = /^[a-zA-Z0-9]{8}$/;

//array for login users
const loggedInUsers = new Map();


io.on('connection', function (socket) {
  
  //save the client socket id
  clients[socket.id] = socket;


  //url handling
  const referer = socket.handshake.headers.referer;
  const canvasUrl = new URL(referer);
  const canvasPathname = canvasUrl.pathname;

  let code = null;
  if (canvasPathname === '/') {

    //new canvas

    code = UniqueCanvasCode();
    canvases.push(new canvas(code,socket.id));
    socket.emit('code', code);

    console.log(`User ${socket.id} connected to new canvas and got ${code}`);
  } else {
    
    //url with code

    const canvasCode = canvasPathname.slice(1);
    if (canvasCodeRegex.test(canvasCode)) {

      //code is by our standarts

      if (canvasExist(canvasCode)) {

        //code exists

        console.log(`User ${socket.id} connected to canvas ${canvasCode}`);
        code = canvasCode;
        addUser(socket.id,code);
        sendCanvasObjectsToClient(code,socket.id)
        }
      else
      {

        //code does not exists

        socket.emit('noCanvas', canvasCode);
      }
      
    } 
  }

  //send all object from canvas to new joined user
  function sendCanvasObjectsToClient(canvasCode, clientId) {
    const canvasInstance = getCanvas(canvasCode);
    if (canvasInstance) {
      clients[clientId].emit('backgroundColorChange', canvasInstance.color);
      const objects = canvasInstance.objects;
      Object.keys(objects).forEach(id => {
        clients[clientId].emit('add', id, objects[id]);
      });
    }
  }
  

  //------------------------- object handling on canvas plus background check

  function handleAdd(id, objectData, socket) {
    const whiteboard = getCanvasByClientId(socket.id);
    whiteboard.addObject(id, objectData);
    whiteboard.users.forEach(user => {
      if (user != socket.id) {
        clients[user].emit('add', id, objectData);
      }
    });
  }

  function handleDelete(id, socket) {
    const whiteboard = getCanvasByClientId(socket.id);
    whiteboard.deleteObject(id);
    whiteboard.users.forEach(user => {
      if (user != socket.id) {
        clients[user].emit('delete', id);
      }
    });
  }

  function handleModify(id, objectData, socket) {
    const whiteboard = getCanvasByClientId(socket.id);
    whiteboard.modifyObject(id, objectData);
    whiteboard.users.forEach(user => {
      if (user != socket.id) {
        clients[user].emit('modify', id, objectData);
      }
    });
  }

  function HandleBackgorundChange(color, socket)
  {
    const whiteboard = getCanvasByClientId(socket.id);
    whiteboard.color = color;
    whiteboard.users.forEach(user => {
      if (user != socket.id) {
        clients[user].emit('backgroundColorChange', color);
      }
    });

  }
  

  socket.on('add', function (id, objectData) {
    console.log('object added');
    handleAdd(id, objectData, socket);
  });


  socket.on('delete', function (id) {
    console.log('object deleted');
    handleDelete(id, socket);
  });


  socket.on('modify', function (id, objectData) {
    console.log('object modified');
    handleModify(id, objectData, socket);
  });

  socket.on('backgroundColorChange', (color) => {
    HandleBackgorundChange(color,socket);
  });


  //locking and unlocking canvas

  socket.on('lock', function () {
    console.log('lock');
    let tmpcv = getCanvasByClientId(socket.id);
    tmpcv.lock = true;

  });
  socket.on('unlock', function () {
    console.log('unlock');
    let tmpcv = getCanvasByClientId(socket.id);
    tmpcv.lock = false;
  });

  //log out

  socket.on('logout', (login_code) => {
    loggedInUsers.delete(login_code);
  });

  //check if user has valid login_code, is logged in
  socket.on("islogged", (login_code) => {
    if (loggedInUsers.has(login_code)) {
      const user_id = loggedInUsers.get(login_code).user_id;
      socket.emit("user_is_logged");
    } else {
      socket.emit("user_is_not_logged");
    }
  });
  
  //generate unique login_code

  async function generateUniqueLoginCode() {
    let login_code;
    do {
      login_code = cryptoRandomString({ length: 10 });
    } while (loggedInUsers.has(login_code));
    return login_code;
  }
  
  // check if user is in db and is active
  function loginUser(email, password, socket) {
    const connection = createMySQLConnection();
    connection.connect();
  
    const sql = 'SELECT * FROM person WHERE email = ? AND password = ?';
    connection.query(sql, [email, password], (err, results, fields) => {
      if (err) {
        console.error(err.message);
      } else if (!results || results.length === 0) {
        socket.emit('dbresult', 'No user found with these credentials.');
      } else {
        const row = results[0];
        if (row.active === 1) {
          const user_id = row.person_id;
          generateUniqueLoginCode()
            .then((login_code) => {
              loggedInUsers.set(login_code, { user_id: user_id });
              socket.emit('succesfulllogin', login_code);
              console.log(loggedInUsers);
            })
            .catch((err) => {
              console.error(err.message);
            });
        } else {
          socket.emit('dbresult', 'User not active.');
        }
      }
      connection.end();
    });
  }

  // check if user email is not in db, try to insert new client into db, sned activation code 
  // to email
  
  function registerUser(email, password, socket) {
    const connection = createMySQLConnection();
    const checkEmailSql = 'SELECT * FROM person WHERE email = ?';
  
    connection.query(checkEmailSql, [email], (err, results) => {
      if (err) {
        console.error(err.message);
      } else if (results.length) {
        socket.emit('dbresult', 'Email already exists.');
        connection.end();
      } else {
        generateUniqueActiveCode(connection)
          .then((active_code) => {
            const insertUserSql = 'INSERT INTO person (email, password, active, active_code) VALUES (?, ?, ?, ?)';
            
            connection.query(insertUserSql, [email, password, 0, active_code], function (err, results) {
              if (err) {
                console.error(err.message);
              } else {
                socket.emit('active_code_send','Code has been sent');
                socket.emit('dbresult', 'User registered successfully.');
                sendEmail(email, 'Account activation', `Your activation code is: ${active_code}`);
              }
              connection.end();
            });
          })
          .catch((err) => {
            console.error(err.message);
            connection.end();
          });
      }
    });
  }
  
  //generating unique checing code for email activation
  async function generateUniqueActiveCode(connection) {
    let active_code = generateCode();
    const checkActiveCodeSql = 'SELECT * FROM person WHERE active_code = ?';
  
    const isCodeUnique = (code) => {
      return new Promise((resolve, reject) => {
        connection.query(checkActiveCodeSql, [code], (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(!results.length);
          }
        });
      });
    };
  
    while (!(await isCodeUnique(active_code))) {
      active_code = generateCode();
    }
  
    return active_code;
  }
  
  //function to start password recovery, checking email, setting reset_code in db, sending 
  //recover code

  function recoverPassword(email, socket) {
    const connection = createMySQLConnection();
    const sql = 'SELECT * FROM person WHERE email = ?';
  
    connection.query(sql, [email], (err, results) => {
      if (err) {
        console.error(err.message);
        connection.end();
      } else if (!results.length) {
        socket.emit('dbresult', 'No user found with this email.');
        connection.end();
      } else {
        generateUniqueResetCode(connection)
          .then((reset_code) => {
            const updateResetCodeSql = 'UPDATE person SET reset_code = ? WHERE email = ?';
            
            connection.query(updateResetCodeSql, [reset_code, email], function (err, results) {
              if (err) {
                console.error(err.message);
              } else {
                socket.emit('code_send','Code has been sent');
                socket.emit('dbresult', 'User found. Password recovery initiated.');
                sendEmail(email, 'Password recovery', `Your password reset code is: ${reset_code}`);
              }
              connection.end();
            });
          })
          .catch((err) => {
            console.error(err.message);
            connection.end();
          });
      }
    });
  }
  
  //generating unique reseet_code
  async function generateUniqueResetCode(connection) {
    let reset_code = generateCode();
    const checkResetCodeSql = 'SELECT * FROM person WHERE reset_code = ?';
  
    const isCodeUnique = (code) => {
      return new Promise((resolve, reject) => {
        connection.query(checkResetCodeSql, [code], (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(!results.length);
          }
        });
      });
    };
  
    while (!(await isCodeUnique(reset_code))) {
      reset_code = generateCode();
    }
  
    return reset_code;
  }
  
  

  // ------------- user account listeners

  socket.on("login", (data) => {
    const loginData = JSON.parse(data);
    const email = loginData.email;
    const password = loginData.password;
    loginUser(email, password, socket);
  });
  
  socket.on("register", (data) => {
    const registrationData = JSON.parse(data);
    const email = registrationData.email;
    const password = registrationData.password;
    registerUser(email, password, socket);
  });
  
  socket.on("recover_password", (data) => {
    const recoveryData = JSON.parse(data);
    const email = recoveryData.email;
    recoverPassword(email, socket);
  });

  socket.on("change_password", (data) => {
    const recoveryData = JSON.parse(data);
    const email = recoveryData.email;
    const password = recoveryData.password;
    const codeinput = recoveryData.codeinput;
  
    updatePasswordIfCodeMatches(email, codeinput, password, socket);
  });
  
  //check if user reset_code is valid with email, change the password
  function updatePasswordIfCodeMatches(email, codeinput, password, socket) {
    const connection = createMySQLConnection();
    const sql = 'SELECT * FROM person WHERE email = ? AND reset_code = ?';
  
    connection.query(sql, [email, codeinput], (err, results) => {
      if (err) {
        console.error(err.message);
        connection.end();
      } else if (results.length < 1) {
        socket.emit('change_denied', 'No user found with this email and reset code.');
        connection.end();
      } else {
        const updatePasswordSql = 'UPDATE person SET password = ?, reset_code = NULL WHERE email = ? AND reset_code = ?';
        
        connection.query(updatePasswordSql, [password, email, codeinput], function (err, results) {
          if (err) {
            console.error(err.message);
          } else {
            socket.emit('change_confirmed', 'Password changed successfully.');
          }
          connection.end();
        });
      }
    });
  }

  // activate the account listener
  socket.on("activated_account", (data) => {
    const activateData = JSON.parse(data);
    const email = activateData.email;
    const codeinput = activateData.codeinput;
    activateAccount(email, codeinput, socket);
  });

  //check for the account
  //upadte the account so that clients can join

  function activateAccount(email, codeinput, socket) {
    const connection = createMySQLConnection();
    const sql = 'SELECT * FROM person WHERE email = ? AND active_code = ?';

    connection.query(sql, [email, codeinput], (err, results) => {
        if (err) {
            console.error(err.message);
            connection.end();
        } else if (!results.length) {
            socket.emit('dbresult', 'No user found with this email and activation code.');
            connection.end();
        } else {
            const updateActivationSql = 'UPDATE person SET active = 1, active_code = NULL WHERE email = ?';

            connection.query(updateActivationSql, [email], (err, results) => {
                if (err) {
                    console.error(err.message);
                } else {
                    socket.emit('dbresult', 'Your account has been successfully activated.');
                }
                connection.end();
            });
        }
    });
}

// get ids of existings canvases to logged user
function getUserCanvasIDs(loginCode, socket) {
  const user_id = loggedInUsers.get(loginCode).user_id;
  const connection = createMySQLConnection();
  connection.connect();

  const sql = 'SELECT canvas_id, name FROM canvas WHERE person_id = ?';
  connection.query(sql, [user_id], (err, results, fields) => {
    if (err) {
      console.error(err.message);
    } else {
      socket.emit('orderedCanvasIDs', results.map(result => ({canvas_id: result.canvas_id, name: result.name})));
    }
    connection.end();
  });
}

socket.on('getCanvasIDs', (loginCode) => {

  if (!loggedInUsers.has(loginCode)) {
    console.log("UnLogged user tried to get canvases ids");
    return;
  } 

  getUserCanvasIDs(loginCode, socket);
});

socket.on('getCanvas', (canvasId, loginCode) => {

  if (!loggedInUsers.has(loginCode)) {
    console.log("UnLogged user tried to load canvas");
    return;
  } 

  const user_id = loggedInUsers.get(loginCode).user_id;
  const connection = createMySQLConnection();
  connection.connect();

  const sql = 'SELECT json FROM canvas WHERE canvas_id = ? AND person_id = ?';
  connection.query(sql, [canvasId, user_id], (err, results, fields) => {
    if (err) {
      console.error(err.message);
    } else {
      if (results.length > 0) {
        const canvasJson = results[0].json;
        const canvasObjects = JSON.parse(canvasJson).objects;
        socket.emit('backgroundColorChange', JSON.parse(canvasJson).background);
        
        socket.emit('canvasDataStart');
        canvasObjects.forEach(object => {
          socket.emit('canvasObject', JSON.stringify(object));
        });
        socket.emit('canvasDataEnd');
        socket.emit('backgroundColorChange', JSON.parse(canvasJson).background);
        
      } else {
        socket.emit('canvasDataStart');
        socket.emit('canvasDataEnd');
      }
    }
    connection.end();
  });
});


function saveNewCanvas(login_code, canvas_name, canvas_json, socket) {
  const user_id = loggedInUsers.get(login_code).user_id;
  const connection = createMySQLConnection();
  connection.connect();

  const sql = 'INSERT INTO canvas (person_id, name, json) VALUES (?, ?, ?)';
  connection.query(sql, [user_id, canvas_name, canvas_json], (err, results, fields) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('New canvas has been saved successfully.');
      getUserCanvasIDs(login_code, socket);
    }
    connection.end();
  });
}

let newCanvasObjects = [];
let canvasName = '';
let canvasColor = 'white';


socket.on('newCanvasStart', (data) => {

  newCanvasObjects = [];
  canvasName = data.canvas_name;
  canvasColor = data.color;
});

socket.on('newCanvasObject', (data) => {
  newCanvasObjects.push(JSON.parse(data.canvas_object));
});

socket.on('newCanvasEnd', (login_code) => {

  if (!loggedInUsers.has(login_code)) {
    console.log("UnLogged user tried to add canvas");
    return;
  } 

  const canvasJSON = JSON.stringify({ objects: newCanvasObjects, background: canvasColor });
  saveNewCanvas(login_code, canvasName, canvasJSON, socket);
});


function deleteCanvasFromDatabase(canvasId) {
  const connection = createMySQLConnection();
  connection.connect();

  const sql = 'DELETE FROM canvas WHERE canvas_id = ?';
  connection.query(sql, [canvasId], (err, results, fields) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log(`Canvas with id ${canvasId} has been deleted.`);
    }
    connection.end();
  });
}


socket.on('deleteCanvas', (canvasId, login_code) => {

  if (loggedInUsers.has(login_code)) {
    deleteCanvasFromDatabase(canvasId);
  } else {
    console.log("UnLogged user tried to delete canvas");
  }

});



socket.on('disconnect', function () {
    removeClient(socket.id);
    delete clients[socket.id];
    console.log(`User ${socket.id} DISconnected from canvas ${code}`);
  });
});


http.listen(3000, '0.0.0.0', function () {
  console.log('listening on *:3000');
});

function UniqueCanvasCode() {
  let code =  '';
  while (1) {
    code =  generateCode() ;
    let count = 0;
    for (let index = 0; index < canvases.length; index++) {
      if (canvases[index][0] == code) {
        count += 1;
      }
    }
    if (count == 0) { 
      break;
    }
  }
  return code;
}



function generateCode() {
  let code = '';

  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars.charAt(randomIndex);
  }
   
  return code;
}


function removeClient(client) {
  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const index = canvas.users.indexOf(client);
    if (index !== -1) {
      canvas.users.splice(index, 1);
      if (canvas.users.length == 0) {
        canvases.splice(i,1);
      }
     }
  }
}

function getCanvasByClientId(clientId) {
  for (let i = 0; i < canvases.length; i++) {
    for (let e = 0; e < canvases[i].users.length; e++) {
      if (canvases[i].users[e] == clientId) {
        return canvases[i];
      }
    }
  }
}

function addUser(clientID, code) {
  for (let i = 0; i < canvases.length; i++) {
    if (canvases[i].code == code) {
      canvases[i].addClient(clientID);
    }
  }
}

function getCanvas(code) {
  for (let i = 0; i < canvases.length; i++) {
    if (canvases[i].code == code) {
      return canvases[i];
    }
  }
}


function canvasExist(code) {
  for (let i = 0; i < canvases.length; i++) {
    if (canvases[i].code == code) {
      return true;
    }
  }
  return false; 
}







