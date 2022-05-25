const {MongoClient} = require('mongodb');
var express = require('express');
var app = express();
const path = require('path');
const jwt = require('jsonwebtoken');
const { get } = require('express/lib/response');
const res = require('express/lib/response');
const dotenv = require('dotenv').config();

const urlParser = express.urlencoded();

// Stuff we need to access the database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@nolans-eleos-db.hlgtg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);
async function connectToDB() {
  try {
    await client.connect();
  } catch (e) {
    console.error(e);
  }
}

// Check provided key against validated eleos platform key
function authorized(key) {
  if(key === process.env.ELEOS_PLATFORM_KEY) return true;
  return false;
}

// Confirm that the passed in token is indeed a JWT
async function verifyToken(token) {
  try {
    jwt.decode(token);
    return true;
  } catch(e) {
    return false;
  }
}

// Get a user's user info from their username
async function getUser(username) {
  const users = client.db("Integration_DB").collection("Users");
  let user = await users.find({username : username}).toArray();
  if(user[0] == undefined) return null;
  return user[0];
}

// Get a user's username from their decoded JWT
async function getUsername(decoded) {
  // Try with schema link
  try{
    var username = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
  } catch(e) {
    var username = null;
  }
  var user = await getUser(username);
  if(user == null) {
    // Try with username
    var username = decoded.username;
    var user = await getUser(username);
  }
  if(user == null) return user;
  return user.username;  
}

// Get a user's loads from their username
async function getLoads(username) {
  const loads = client.db("Integration_DB").collection("Loads");
  let usersLoads = await loads.find({users: username}).toArray();
  usersLoads.forEach(u => delete u._id);
  usersLoads.forEach(u => delete u.users);
  return usersLoads;
}

// Get a users's truck from their username
async function getTruck(username) {
  const trucks = client.db("Integration_DB").collection("TruckStatus");
  let truck = await trucks.find({username: username}).toArray();
  truck = truck[0];
  delete truck._id;
  delete truck.username;
  Object.keys(truck).forEach(key => truck[key] === undefined ? delete truck[key] : {});
  return truck;
}

// Get a user's todo items from their username
async function getTodos(username) {
  const todos = client.db("Integration_DB").collection("Todos");
  let usersTodos = await todos.find({username: username, completed_at: {$in: ["",undefined]} }).toArray();
  usersTodos.forEach(u => delete u._id);
  usersTodos.forEach(u => delete u.username);  
  usersTodos.forEach(u => delete u.completed_at);
  return usersTodos;
}

// Access the main webpage
app.get('/', function (req, res) {
  try {
    res.sendFile(path.join(__dirname, '/public/index.html'));
  } catch (e) {
    console.error(e);
    res.send("400 " + e);
  }
})

// Authenticate a user in the database based on api token
app.get('/authenticate/:token', async (req, res) => {
  // This is coming from Eleos, right?
  if(!authorized(req.get("Eleos-Platform-Key")))
  {
    res.status(401).send("401 Unauthorized due to missing or invalid token and/or API key.");
    return;
  }

  // Okay good. it is.
  try{
    await connectToDB().catch(console.error);

    // Try to decode the token. If it fails its a bad request.
    try{
      var decoded = jwt.decode(req.params.token);
    } catch(e) {
      res.status(401).send("401 Unauthorized due to missing or invalid token and/or API key.");
      client.close();
      return;
    }
    // Extract the user's name
    var username = await getUsername(decoded);
    // Verify that the user exists
    if(username == null){
      res.status(401).send("401 Unauthorized due to invalid username or password.");
      client.close();
      return;
    }
    // Steal all their data
    var user = await getUser(username);

    // Generate api token for user
    let encoded = jwt.sign({full_name : user.full_name, username : user.username}, process.env.SECRET_KEY);

    // Spit out user's data
    const response = {
      full_name : user.full_name,
      username : user.username,
      api_token : encoded,
      menu_code : user.menu_code,
      dashboard_code : user.dashboard_code,
      custom_settings_form_code : user.custom_settings_form_code
    }
    console.log(response);
    res.send(response);
    await client.close();

  } catch(e) {
    // uh oh! If we made it here we ran into a problem...
    console.error(e);
    res.status(400).send("400 " + e);
  }
})

// Show all the loads of a specific user
app.get('/loads', async (req, res) => {
  // Confirm that this is Eleos making the request
  if(!authorized(req.get("Eleos-Platform-Key")))
  {
    res.status(401).send("401 Unauthorized due to missing or invalid token and/or API key.");
    return;
  }

  // Phew! It is Eleos!
  try {
    await connectToDB().catch(console.error);

    // Verify user's authorization
    if(!verifyToken(req.get("authorization"))){
      res.status(401).send("401 Unauthorized due to missing or invalid token and/or API key.");
      client.close();
      return;
    }
    let token = req.get("authorization");
    // fix the weird formatting
    token = token.split("=").pop();
    var decoded = jwt.decode(token);

    // What's their username?
    var username = await getUsername(decoded);
    // Verify that this user exists
    if(username == null){
      res.status(401).send("401 Unauthorized due to invalid username or password.");
      client.close();
      return;
    }

    // Get a load of this!
    let response = await getLoads(username);

    // Give Eleos all the data
    console.log(response);
    res.send(response);
    await client.close();

  } catch(e) {
    // We shouldn't be here, but here we are...
    console.error(e);
    res.status(400).send("400 " + e);
  }
})

// Let users send messages to the database
app.put('/messages/:handle', urlParser, async (req, res) => {
  // Eleos? Is that you?
  if(!authorized(req.get("Eleos-Platform-Key")))
  {
    res.status(401).send("401 Unauthorized due to missing or invalid token and/or API key.");
    return;
  }

  // Yes! It's Eleos!!!
  try {
    await connectToDB().catch(console.error);

    // Store some important info about the message
    let handle = req.params.handle;
    let body = req.body;
    let messages = client.db("Integration_DB").collection("Messages");

    // Send user's important message to the database
    await messages.insertOne({
      handle: handle,
      direction: body.direction,
      username: body.username,
      message_type: body.message_type,
      body: body.body,
      composed_at: body.composed_at,
      platform_received_at: body.platform_received_at
    })

    // Give the handle back to Eleos
    res.send({handle : handle});
    await client.close();

  } catch(e) {
    // We ran into a problem if we're down here.
    console.error(e);
    res.status(400).send({description : "Error: 400 Bad Request", code: "400"});
  }
})

// Keep on truckin'! Let's see the user's truck status.
app.get('/truck', async (req, res) => {
  // This is from Eleos, correct?
  if(!authorized(req.get("Eleos-Platform-Key")))
  {
    res.status(401).send("401 Unauthorized due to missing or invalid token and/or API key.");
    return;
  }

  // Indeed, it is!
  try {
    await connectToDB().catch(console.error);

    // Verify the user's authorization
    if(!verifyToken(req.get("authorization"))){
      res.status(401).send("401 Unauthorized due to missing or invalid token and/or API key.");
      client.close();
      return;
    }
    let token = req.get("authorization");
    // Fix the silly formatting
    token = token.split("=").pop();
    var decoded = jwt.decode(token);

    // Figure out who this user actually is
    var username = await getUsername(decoded);

    // Verify that the user even exists
    if(username == null){
      res.status(401).send("401 Unauthorized due to invalid username or password.");
      client.close();
      return;
    }

    // Extract the user's truck info
    let truck = await getTruck(username);

    // Send truck info back to Eleos
    console.log(truck);
    res.send(truck);
    await client.close();

  } catch(e) {
    // Something errant must have happened if we're down here...
    console.error(e);
    res.send("400 " + e);
  }
})

// Get the user's todo list
app.get('/todos', async (req, res) => {
    // Is this from Eleos?
    if(!authorized(req.get("Eleos-Platform-Key")))
    {
      res.status(401).send("401 Unauthorized due to missing or invalid token and/or API key.");
      return;
    }
  
    // Yup, it is from Eleos!
    try {
      await connectToDB().catch(console.error);

      // Verify the user's authorization
      if(!verifyToken(req.get("authorization"))){
        res.status(401).send("401 Unauthorized due to missing or invalid token and/or API key.");
        client.close();
        return;
      }
      let token = req.get("authorization");
      // Get rid of what we don't need
      token = token.split("=").pop();
      var decoded = jwt.decode(token);

      // Figure out who the user is
      var username = await getUsername(decoded);

      // Verify that the user exists
      if(username == null){
        res.status(401).send("401 Unauthorized due to invalid username or password.");
        client.close();
        return;
      }

      // Get the user's todo list
      let todos = await getTodos(username);

      // Send todos back to Eleos
      console.log(todos);
      res.send(todos);
      await client.close();

    } catch (e) {
      // There must've been an issue if this code runs.
      console.error(e);
      res.status(400).send("400 " + e);
    }
})

// Allow a user to mark a todo item as completed
app.put('/todos/:handle', urlParser, async (req, res) => {
  // Is this request from Eleos?
  if(!authorized(req.get("Eleos-Platform-Key")))
  {
    res.status(401).send("401 Unauthorized due to missing or invalid token and/or API key.");
    return;
  }

  // Yes, it's from Eleos!
  try {
    await connectToDB().catch(console.error);

    // Store some important info about the todo completion
    let handle = req.params.handle;
    let body = req.body;
    let messages = client.db("Integration_DB").collection("Messages");

    // Send user's completion time to databse
    console.log(body);
    const filter = {handle: handle};
    const update = {$set: {completed_at: body.completed_at}};
    await messages.findOneAndUpdate(filter, update);

    // Send handle back to Eleos
    res.send({handle : handle});
    await client.close();

  } catch (e) {
    // There must've been an issue if this code runs.
    console.error(e);
    res.status(400).send({description : "Error: 400 Bad Request", code: "400"});
  }
})

// Listen out for anyone that needs to use any of the services
app.listen(process.env.PORT || 3000, 
  () => console.log("The server is running!!!"));