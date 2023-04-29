CREATE DATABASE IF NOT EXISTS freehand;

USE freehand;

CREATE TABLE IF NOT EXISTS person (
  person_id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  active INT NOT NULL DEFAULT 0,
  active_code VARCHAR(255) DEFAULT NULL,
  reset_code VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS canvas (
  canvas_id INT NOT NULL AUTO_INCREMENT,
  person_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name VARCHAR(255) NOT NULL,
  json MEDIUMTEXT NOT NULL,
  PRIMARY KEY (canvas_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);
INSERT INTO person (email, password, active) VALUES ('admin', 'admin', 1);
