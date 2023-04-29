
      

      // socket
      var socket = io();
      var isReceiving = false;

      //url
      socket.on("code", function (msg) {
        let path = '/' + msg
        history.pushState({}, null, path);
      });

      socket.on('noCanvas', function (msg) {
        window.location.href = '/' + msg;
      });
      


      //canvas setup
      var canvas = new fabric.Canvas("canvas", { backgroundColor: "white" });
      setCanvasDimensions();

      function setCanvasDimensions() {
        canvas.setHeight(window.innerHeight);
        canvas.setWidth(window.innerWidth);
        canvas.renderAll();
      }

      // Listen for window resize events
      window.addEventListener("resize", setCanvasDimensions);

      //mainly for width
      var pencilBrush = new fabric.PencilBrush(canvas);
      pencilBrush.color = "#000000";
      pencilBrush.width = 2;
      canvas.freeDrawingBrush = pencilBrush;
      canvas.isDrawingMode = true;
      
      //*********************************************************************** Helping variables

      // text and drawing color
      drColor = "#000000";
      //backgorund color
      bgColor = "black"

      //zoom helpers
      var zoomLevel = 1;
      var cursorOffsetX = 0;
      var cursorOffsetY = 0;

      //imgs and text
      var toPutText = false;
      var toPutImg = false;

      // setup fro comm
      var json = JSON.stringify(canvas.toJSON());
      socket.emit("change", json);
      //*********************************************************************** BUTTONS

      //buttons listeners
      document.getElementById("drawButton").addEventListener("click", makeDraw);
      document.getElementById("moveButton").addEventListener("click", makeMove);
      document.getElementById("delButton").addEventListener("click", makeDel);
      document.getElementById("drawRange").addEventListener("click", changeDraw);
      document.getElementById("imgButton").addEventListener("click", makeImg);
      document.getElementById("textButton").addEventListener("click", makeText);
      document.getElementById("bgButton").addEventListener("click", makeBackground);

      function removeSelectedClass(name) {
        const leftBar = document.getElementById('leftBar');
        const children = leftBar.children;
        for (let i = 0; i < children.length; i++) {
          children[i].classList.remove('selected');
        }
        if(name != "move"){
          document.getElementById("deleteButtonDiv").classList.remove("shown");
        }

        if(name != "img"){
          toPutImg = false;
        }

        if(name != "text"){
          toPutText = false;
        }
      }
      
      //buttons Functions
      /* DRAW */
      function makeDraw() {
        canvas.isDrawingMode = true;
        canvas.selection = false;
        document.getElementById("drawButton").classList.add("opened");
        removeSelectedClass("draw");
        document.getElementById("drawButton").classList.add("selected");
        
      }

      maincolor.addEventListener("input", function () {
        let color = maincolor.value;
        setPenColor(color);
      });

      function setPenColor(color){
        document.getElementById('maincolor').value = color;
        canvas.freeDrawingBrush.color = color;
        drColor = color;
      };
      /* DRAW */

      /* BACKGROUND  */
      function makeBackground() {
        document.getElementById("bgButton").classList.add("opened");
        removeSelectedClass("bg");
        document.getElementById("bgButton").classList.add("selected");
      }
      
      bgcolor.addEventListener("input", function () {
        let color = bgcolor.value;
        setBgColor(color);
      });

      function setBgColor(color){
        document.getElementById('bgcolor').value = color;
        canvas.backgroundColor = color;
        canvas.renderAll();
        bgColor = color;
        socket.emit('backgroundColorChange', color);
      };
      
      /* BACKGROUND  */

      document.addEventListener("mousedown", function(event) {
        var drawBtn = document.getElementById("drawButton");
        if (!drawBtn.contains(event.target)) {
          drawBtn.classList.remove("opened");
        }

        var bgBtn = document.getElementById("bgButton");
        if (!bgBtn.contains(event.target)) {
          bgBtn.classList.remove("opened");
        }
      });

      function makeMove() {
        canvas.isDrawingMode = false;
        canvas.selection = true;
        removeSelectedClass("move");
        document.getElementById("moveButton").classList.add("selected");
        document.getElementById("deleteButtonDiv").classList.add("shown");
      }

      function makeDel() {
        var activeObjects = canvas.getActiveObjects();
        if (activeObjects.length) {
          activeObjects.forEach(function(object) {
            canvas.remove(object);
          });
        }
        document.getElementById("delButton").classList.add("selected");
        canvas.discardActiveObject();
      }    

      function changeDraw() {
        pencilBrush.width = parseInt(document.getElementById("drawRange").value);
      }

      


      // imgs and text
      canvas.on("mouse:down", function (event) {
        if (toPutText) {
          addText(event);
        }
        if (toPutImg) {
          addImg(event);
        }
      });

      function makeText() {
        
        canvas.isDrawingMode = false;
        canvas.discardActiveObject();
        toPutText = true;
        removeSelectedClass("text");
        document.getElementById("textButton").classList.add("selected");
      }
      
      function makeImg() {
        
        canvas.isDrawingMode = false;
        canvas.discardActiveObject();
        toPutImg = true;
        removeSelectedClass("img");
        document.getElementById("imgButton").classList.add("selected");
      }

      function generateId() {
        return Math.random().toString(36).substr(2, 9);
      }
      /*
      function setObjectId(object) {
        object.id = generateId();
      }
      */
      //helping functions for text and imegs

      function addText(event) {
        var pointer = canvas.getPointer(event.e);
        var text = new fabric.IText("", {
          left: pointer.x,
          top: pointer.y,
          fontFamily: "Arial",
          fontSize: 36,
          fill: "red",
        });
        text.set("fill", drColor);
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        // toPutText = false;

        // Add an event listener for the editing:exited event
        text.on('editing:exited', function () {
          // Check if the text object has an empty string
          if (text.text === "") {
            // Remove the text object from the canvas
            canvas.remove(text);
          }
        });
      }

      function addImg(event) {
        canvas.selection = false;
        canvas.isDrawingMode = false;
      
        var pointer = canvas.getPointer(event.e);
      
        var input = document.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg, image/png";
        input.addEventListener("change", function (event) {
          var file = event.target.files[0];
      
          // Maximum allowed file size (in bytes), for example 5MB
          const maxFileSize = 1 * 1024 * 1024;
      
          if (file.size > maxFileSize) {
            toast("The selected image is too large. Please choose an image og maximu size 1MB.");
            return;
          }
      
          var reader = new FileReader();
      
          reader.onload = function (event) {
            var dataURL = event.target.result;
        
            fabric.Image.fromURL(dataURL, function (img) {
              img.set({
                left: pointer.x,
                top: pointer.y,
              });
              canvas.add(img);
              canvas.discardActiveObject(); // Add this line to deselect the active object after adding the new image
            });
          };
      
          reader.readAsDataURL(file);
        });
        // toPutImg = false;
        input.click();
        canvas.__onMouseUp({});
        canvas.discardActiveObject();
      }
      
 

      
    



      // ZOOM function
      canvas.on("mouse:wheel", function (options) {
        var delta = options.e.deltaY;
        zoomLevel *= 0.999 ** delta;
        if (zoomLevel > 20) zoomLevel = 20;
        if (zoomLevel < 0.01) zoomLevel = 0.01;

        canvas.zoomToPoint({ x: options.e.offsetX, y: options.e.offsetY }, zoomLevel);
        // Adjust cursor position to account for zoom level
        cursorOffsetX *= 0.999 ** delta;
        cursorOffsetY *= 0.999 ** delta;
        options.e.offsetX -= cursorOffsetX;
        options.e.offsetY -= cursorOffsetY;
        options.e.preventDefault();
      });

      socket.on('backgroundColorChange', (color) => {
        canvas.backgroundColor = color;
        canvas.renderAll();
      });

      
      
      //*********************************************************************** Canvas listeners

      

      canvas.on("object:added", function (event) {
        // Don't emit event when receiving objects from the server
        if (!isReceiving) {
          let obj = event.target;
          obj.id = generateId();
          socket.emit("add", obj.id, JSON.stringify(obj.toJSON()));
        }
      });
      
      canvas.on("object:modified", function (event) {
        const obj = event.target;
        socket.emit("modify", obj.id, JSON.stringify(obj.toJSON()));
      });
      
      canvas.on("object:removed", function (event) {
        const obj = event.target;
        socket.emit("delete", obj.id);
      });
      

      //*********************************************************************** socket listeners

      socket.on("add", function (id, objectData) {
        isReceiving = true;
        fabric.util.enlivenObjects([JSON.parse(objectData)], function (objects) {
          objects.forEach(function (obj) {
            obj.id = id;
            canvas.add(obj);
            canvas.renderAll();
            isReceiving = false;
          });
        });
      });
      
      
      socket.on("delete", function (id) {
        const obj = canvas.getObjects().find(o => o.id === id);
        if (obj) {
          isReceiving = true;
          canvas.remove(obj);
          canvas.renderAll();
          isReceiving = false;
        }
      });
      
      socket.on("modify", function (id, objectData) {
        isReceiving = true;
        const existingObject = canvas.getObjects().find(o => o.id === id);
        if (existingObject) {
          fabric.util.enlivenObjects([JSON.parse(objectData)], function (objects) {
            objects.forEach(function (obj) {
              existingObject.set(obj.toObject());
              canvas.renderAll();
              isReceiving = false;
            });
          });
        }
      });
      

      /* CANVAS MODALS */

      var canvasModal = document.getElementById("theModal");
      var mainModal = document.getElementById("mainModalDiv");

      window.onclick = function(event) {
        if (event.target == canvasModal) {
          closeModal();
        }
        if (event.target == mainModal) {
          closeMainModal();
        }
      }

      var span = document.getElementsByClassName("close")[0];
      document.getElementById("cancelButton").addEventListener("click", tryCloseModal);

      span.onclick = function() {
        closeModal();
      }

      function tryCloseModal(){
        var action = modalBody.getAttribute("data-action");
        if(action == "export"){
          makePNG();
        }
        closeModal();
      }
      function closeModal(){
        canvasModal.style.display = "none";
      }

      document.getElementById("resetButton").addEventListener("click", showResetModal);
      document.getElementById("lockButton").addEventListener("click", showLockModal);
      document.getElementById("exportButton").addEventListener("click", showExportModal);

      var mainTitleSpan = document.getElementById("mainTitle");
      var littleTitleSpan = document.getElementById("littleTitle");


      function showResetModal() {
        canvasModal.style.display = "block";
        modalBody.setAttribute("data-action", "reset");
        mainTitleSpan.innerHTML = "Do you really wish to reset your Whiteboard?";
        littleTitleSpan.innerHTML = "All data will be pernamently lost";
        confirmButton.innerHTML = "Confirm";
        cancelButton.innerHTML = "Cancel";
      }

      function showLockModal() {
        canvasModal.style.display = "block";
        modalBody.setAttribute("data-action", "lock");
        confirmButton.innerHTML = "Confirm";
        cancelButton.innerHTML = "Cancel";
        if(lockButton.getAttribute("data-state") == "unlock"){
          mainTitleSpan.innerHTML = "Do you wish to lock your Whiteboard?";
          littleTitleSpan.innerHTML = "Other clients won't be able to join this Whiteboard";
        }
        else if (lockButton.getAttribute("data-state") == "lock") {
          mainTitleSpan.innerHTML = "Do you wish to unlock your Whiteboard?";
          littleTitleSpan.innerHTML = "Other clients will now be able to join this Whiteboard";
        } 
      }

      function showExportModal(){
        canvasModal.style.display = "block";
        mainTitleSpan.innerHTML = "Export your Whiteboard";
        littleTitleSpan.innerHTML = "Choose from formats below";
        confirmButton.innerHTML = "JPG";
        cancelButton.innerHTML = "PNG";
        modalBody.setAttribute("data-action", "export");
      }

      document.getElementById("confirmButton").addEventListener("click", makeAction);
      
      function makeAction(){
        var action = modalBody.getAttribute("data-action");
        if(action == "lock"){
          makeLock();
          closeModal();
        }
        else if(action == "reset"){
          makeReset(); 
          closeModal();
        }
        else if(action == "export"){
          makeJPG();
          closeModal();
        }
      }

      function makeLock(){
        var image = lockButton.getElementsByTagName("image")[0];
        if(lockButton.getAttribute("data-state") == "lock"){
          socket.emit("unlock");
          lockButton.setAttribute("data-state", "unlock");
          image.setAttribute("xlink:href", "./assets/unlock.svg");
        }
        else if (lockButton.getAttribute("data-state") == "unlock") {
          socket.emit("lock");
          lockButton.setAttribute("data-state", "lock");
          image.setAttribute("xlink:href", "./assets/lock.svg");
        } 
      };
      
      function makeReset() {
        canvas.clear();  
      }

      function makeJPG() {
        var canvas_string = canvas.toDataURL("image/jpg");
        var link = document.createElement("a");
        link.download = "image.jpg";
        link.href = canvas_string;
        link.click();    
      }

      function makePNG() {
        var originalBackgroundColor = canvas.backgroundColor;
        canvas.backgroundColor = null; // Set the background to transparent
        canvas.renderAll(); // Re-render the canvas to reflect the change
    
        var canvas_string = canvas.toDataURL("image/png");
    
        var link = document.createElement("a");
        link.download = "image.png";
        link.href = canvas_string;
        link.click();
    
        canvas.backgroundColor = originalBackgroundColor; // Restore the original background color
        canvas.renderAll(); // Re-render the canvas again to reflect the change
      }

      /* CANVAS MODALS */


      /* MAIN MODAL */
      
      document.getElementById("openMainModalButton").addEventListener("click", openMainModal);

      
  
      function openMainModal() {
        changeCurrent("login");
        mainModalDiv.classList.add("shown");
      }

      function closeMainModal(){
        recoveryForm.style.display="flex";
        recoveryForm_second.style.display= "none";
        mainModalDiv.classList.remove("shown");
      }
      
      

      function changeCurrent(name){
        const children = mainModalBody.children;
        const childrenHeader = mainModalHeader.children;
        for (let i = 0; i < children.length; i++) {
          children[i].classList.remove('current');
          childrenHeader[i].classList.remove('activated');
        }
        if(name == "login"){
          loginForm.classList.add('current');
          selectLogin.classList.add('activated');
        }
        if(name == "register"){
          registerForm.classList.add('current');
          selectRegister.classList.add('activated');
        }
        if(name == "activate"){
          activateForm.classList.add('current');
          selectActivate.classList.add('activated');
        }
        if(name == "forgot"){
          recoveryMain.classList.add('current');
          selectForgot.classList.add('activated');
        }
      }


      
      /*  MAIN MODAL */
      
      //*********************************************************************** Helping Functions

      let loginForm = document.getElementById("loginForm");
      let registerForm = document.getElementById("registerForm");
      let recoveryForm = document.getElementById("recoveryForm");


      function isValidEmail(email) {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email);
      }
      
      sub_loginForm.addEventListener("click", function () {
        let email = document.getElementById("loginForm_email");
        let password = document.getElementById("loginForm_password");
      
        if (email.value.trim() !== "" && password.value.trim() !== "") {
          if (isValidEmail(email.value.trim())) {
            let loginData = {
              email: email.value.trim(),
              password: password.value.trim()
            };
      
            let json = JSON.stringify(loginData);
            socket.emit("login", json);
            loginForm_email.value = "";
            loginForm_password.value = "";
          } else {
            toast("Please enter a valid email.");
          }
        } else {
          toast("Please enter both email and password.");
        }
      });

      sub_registerForm.addEventListener("click", function () {
        let email = document.getElementById("registerForm_email");
        let password = document.getElementById("registerForm_password");
        let password_again = document.getElementById("registerForm_password_again");

        
      
        if (email.value.trim() !== "" && password.value.trim() !== "" && password_again.value.trim() !== "") {
          if (isValidEmail(email.value.trim())) {
            if (password.value.trim() === password_again.value.trim()) {
              if (password.value.trim().length >= 6) {
                let registrationData = {
                  email: email.value.trim(),
                  password: password.value.trim()
                };

                document.getElementById("registerForm_email").value = "";
                document.getElementById("registerForm_password").value = "";
                document.getElementById("registerForm_password_again").value = "";
              
                let json = JSON.stringify(registrationData);
                socket.emit("register", json);
              } else {
                toast("Password must be at least 6 characters long.");
              }
            } else {
              toast("Passwords do not match. Please re-enter your password.");
            }
          } else {
            toast("Please enter a valid email.");
          }
        } else {
          toast("Please fill in all the fields.");
        }
      });
      
      let tmpemail = "";
      sub_recoveryForm.addEventListener("click", function () {
        let email = document.getElementById("recoveryForm_email");
      
        if (email.value.trim() !== "") {
          if (isValidEmail(email.value.trim())) {
            let recoveryData = {
              email: email.value.trim(),
            };
            tmpemail = email.value.trim();
            document.getElementById("recoveryForm_email").value = "";
            let json = JSON.stringify(recoveryData);
            socket.emit("recover_password", json);

            recoveryForm.style.display="none";
            recoveryForm_second.style.display= "flex";

          } else {
            toast("Please enter a valid email.");
          }
        } else {
          toast("Please enter your email.");
        }

      });

      

      socket.on('change_confirmed', function(message) {
       toast("Password has been changed.");
       recoveryForm.style.display="flex";
       recoveryForm_second.style.display= "none";
       recoveryForm_code.value = "";
       sub_recoveryForm_password.value = "";
       sub_recoveryForm_password_again.value = "";
       changeCurrent("login");
      });

      socket.on('change_denied', function(message) {
       toast("No user found with this email and reset code.");
      });

      
      socket.on('dbresult', function(message) {
        toast(message);
      });
      

      function checkPasswords() {
        let email = tmpemail;
        let codeinput = document.getElementById("recoveryForm_code");
        const password = document.getElementById("sub_recoveryForm_password");
        const passwordAgain = document.getElementById("sub_recoveryForm_password_again");

        if (password.value !== passwordAgain.value) {
            toast("Passwords do not match");
        } else if (password.value.length < 6) {
            toast("Password must be longer than 6 characters");
        } else {
          let recoveryData = {
            email: email,
            password: password.value.trim(),
            codeinput: codeinput.value.trim()
          };
  
          let json = JSON.stringify(recoveryData);
          socket.emit("change_password", json);
        }
      }

     
     
      function checkCode() {
        let email =  document.getElementById("registerForm_code_email");
        let codeinput = document.getElementById("registerForm_code");
        if (!isValidEmail(email.value.trim())) {
          toast("Invalid email");
          return;
        }

        let activateData = {
          email: email.value.trim(),
          codeinput: codeinput.value.trim()
        };
        document.getElementById("registerForm_code_email").value = "";
        document.getElementById("registerForm_code").value = "";
  
        let json = JSON.stringify(activateData);
        socket.emit("activated_account", json);
        
      }

      socket.on('active_code_send', function(message) {
        toast("Activation code has been send to your email");
        changeCurrent('activate');
      });

      



      if (localStorage.getItem('login_code') !== null) {
        socket.emit("islogged", localStorage.getItem('login_code'));
      } 

      socket.on('user_is_logged', function(message) {
        loginprivilege();
      });


      socket.on('user_is_not_logged', function(message) {
        //console.log("User is not Logged In");
        if (localStorage.getItem('login_code') !== null) {
          localStorage.removeItem("login_code");
        } 
      });


      socket.on('succesfulllogin', function(message) {
        localStorage.setItem("login_code", message);
        loginprivilege();
        closeMainModal();
      });

      function loginprivilege() {
        let elementsL = document.querySelectorAll('.loginclass');
        for (let elementL of elementsL) {
          elementL.style.display = 'block';
        }
      
        let elementsC = document.querySelectorAll('.casualclass');
        for (let elementC of elementsC) {
          elementC.style.display = 'none';
        }
      }
      

      function looseloginprivilege() {
        let elementsL = document.querySelectorAll('.loginclass');
        for (let elementL of elementsL) {
          elementL.style.display = 'none';
        }
      
        let elementsC = document.querySelectorAll('.casualclass');
        for (let elementC of elementsC) {
          elementC.style.display = 'block';
        }
      }
      

      logoutButton.addEventListener("click", function () {
        looseloginprivilege();
        socket.emit("logout", localStorage.getItem('login_code'));
        localStorage.removeItem("login_code");
      });
  



      function ContinueToDraw() {
        let form4 = document.getElementById("form4");
        form4.style.display = "none";
      }

      loadSaveButton.addEventListener("click", function () {
        let form4 = document.getElementById("form4");
        form4.style.display = "block";
        socket.emit('getCanvasIDs', localStorage.getItem('login_code'));
      });
      
      const receivedCanvasIDs = [];

      socket.on('orderedCanvasIDs', (canvasIDs) => {
        receivedCanvasIDs.length = 0;
        canvasIDs.forEach((canvas) => {
          receivedCanvasIDs.push(canvas);
        });
        displayCanvasIDs(receivedCanvasIDs);
      });
      

      function addNewCanvas() {
        const canvasName = document.getElementById('form4_canvas_name').value;
        if (canvasName.trim() === '') {
          toast('Please enter a name for the new canvas.');
          return;
        }
      
        const login_code = localStorage.getItem('login_code');
        const canvasObjects = canvas.getObjects().map(obj => JSON.stringify(obj));
      
        socket.emit('newCanvasStart', {
          color: canvas.backgroundColor,
          login_code: login_code,
          canvas_name: canvasName,
        });
      
        canvasObjects.forEach(object => {
          socket.emit('newCanvasObject', {
            login_code: login_code,
            canvas_object: object,
          });
        });
      
        socket.emit('newCanvasEnd', login_code);
      }
      
            
      function displayCanvasIDs(canvasIDs) {
        const canvasesContainer = document.getElementById('all_canvases');
        canvasesContainer.innerHTML = ''; 
      
        canvasIDs.forEach((canvas) => {
          const canvasDiv = document.createElement('div');
          canvasDiv.classList.add('canvas-item');
      
          const canvasName = document.createElement('h3');
          canvasName.innerText = canvas.name;
          canvasDiv.appendChild(canvasName);
      
          const deleteButton = document.createElement('button');
          deleteButton.innerText = 'Delete';
          deleteButton.addEventListener('click', () => {
            deleteCanvas(canvas.canvas_id, canvasDiv);
          });
          canvasDiv.appendChild(deleteButton);
      
          const loadButton = document.createElement('button');
          loadButton.innerText = 'Load';
          loadButton.addEventListener('click', () => {
            loadCanvas(canvas.canvas_id);
          });
          canvasDiv.appendChild(loadButton);
      
          canvasesContainer.appendChild(canvasDiv);
        });
      }
      
      function deleteCanvas(canvasId, canvasDiv) {
        socket.emit('deleteCanvas', canvasId, localStorage.getItem('login_code') );
        canvasDiv.remove();
      }
      
      
  
    function loadCanvas(canvasId) {
      const login_code = localStorage.getItem('login_code');
      socket.emit('getCanvas', canvasId, login_code);
    }

    socket.on('canvasDataStart', () => {
      canvas.clear();
      isReceiving = true;
    });

    socket.on('canvasObject', (objectData) => {
      fabric.util.enlivenObjects([JSON.parse(objectData)], (objects) => {
        objects.forEach((obj) => {
          canvas.add(obj);
          canvas.renderAll();
        });
      });
    });

    socket.on('canvasDataEnd', () => {
      isReceiving = false;
    });



    function toast(message, duration = 3000) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
    
      setTimeout(() => {
        toast.classList.remove('show');
      }, duration);
    }