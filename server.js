const connect_db = require('./connect_db')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')

// Add headers
app.use(function (req, res, next) {

  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Routes
require('./routes/Accessories/index.js')(app, connect_db);
require('./routes/Informs/index.js')(app, connect_db);
require('./routes/Issues/index.js')(app, connect_db);
require('./routes/Users/index.js')(app, connect_db);
require('./routes/Status/index.js')(app, connect_db);
require('./routes/Login/index.js')(app, connect_db);

// App Listen
app.listen(3000, () => {
  console.log('Start server at port 3000.')
})