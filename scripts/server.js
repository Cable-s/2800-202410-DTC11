const express = require('express')
const mongoose = require('mongoose')
const dotenv = require('dotenv').config();
const ejs = require('ejs')
const bcrypt = require('bcrypt')
const { Db } = require('mongodb');
const session = require('express-session')
const MongoStore = require('connect-mongo')

const app = express()
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs")

main().catch(err => console.log(err));

async function main() {
  username = process.env.DB_USERNAME
  password = process.env.DB_PASSWORD
  host = process.env.DB_HOST
  database = process.env.DB_DATABASE
  await mongoose.connect(`mongodb+srv://${username}:${password}@${host}/${database}`)

  app.listen(process.env.PORT || 3000, () => {
    console.log('Server is running')
  })
}

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  phone: String,
  password: String,
  firstName: String,
  lastName: String
})

const deviceSchema = new mongoose.Schema({
  name: String,
})

const users = mongoose.model('2800users', userSchema)
const devices = mongoose.model('devices', deviceSchema)

// create the session/cookie
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: `mongodb+srv://${username}:${password}@${host}/${database}` }), // Store session in MongoDB
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// change this to the homepage
app.get("/", (req, res) => {
  res.redirect("/signUp")
})

app.get("/signUp", (req, res) => {
  res.render("signUp", {
    error: req.query.error
  })
})

app.post("/signUp", async (req, res) => {
  if (req.body.password == req.body.repeat_password) {
    saltRounds = 10
    hashedPassword = await bcrypt.hash(req.body.password, saltRounds)
    createdUser = await users.create({ username: req.body.username, email: req.body.email, phone: req.body.phone, password: hashedPassword, name: req.body.firstName, lastName: req.body.lastName })
  } else {
    return res.redirect("/signUp?error=passwords_dont_match")
  }
  res.redirect("/login")
})

app.get("/login", (req, res) => {
  res.render("login")
})

app.post("/login", async (req, res) => {
  usersUsername = req.body.username
  usersPassword = req.body.password

  const user = await users.findOne({
    username: usersUsername
  })
  if (user) {
    bcrypt.compare(usersPassword, user.password, (err, result) => {
      // authentication here
      req.session.authenticated = true
      console.log("passwords are the same!")
      return res.redirect("homePage")
    })
  } else {
    return res.send("Not authenticated page here").status(401)
  }
})

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/index');
});

// middleware for authentication check
function isAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
}

// now a protected route route
app.get('/homePage', isAuthenticated, (req, res) => {
  res.send(`some home page here`);
});

// the password recovery route
app.get("/recovery", (req, res) => {
  res.render("recovery")
})

// the password recovery form post route
app.post("/recovery", async (req, res) => {
  // if the user is using email to recover
  if (req.body.email) {
    //find user with username and email
    const userForRecovery = await users.findOne({
      username: req.body.username,
      email: req.body.email
    })
    // if the user is found
    if (userForRecovery) {
      // render the new password page and send username, email, phone and a random code that will be sent to the user's email for verification
      res.render("newPassword", {
        username: req.body.username,
        email: req.body.email,
        phone: "",
        code: Math.floor(100000 + Math.random() * 900000)
      })
      //if no user is found
    } else {
      // send a message to the user
      return res.send("User not found")
    }
    // if the user is using phone to recover
  } else if (req.body.phone) {
    // find user with username and phone
    const userForRecovery = await users.findOne({
      username: req.body.username,
      phone: req.body.phone,
    })
    // if the user is found
    if (userForRecovery) {
      // render the new password page and send username, email, phone and a random code that will be sent to the user's phone for verification
      return res.render("newPassword", {
        username: req.body.username,
        email: "",
        phone: user.phone,
        code: Math.floor(100000 + Math.random() * 900000)
      })
      // if the user is not found
    } else {
      // send a message to the user
      return res.send("User not found")
    }
    // if the user is not using email or phone
  } else {
    // send a message to the user
    return res.send("User not found")
  }
})

// the password recovery form post route
app.post("/replacePassword", async (req, res) => {
  // if the user is using email to recover
  if (req.body.email) {
    //find user with username and email
    const userForPasswordChange = await users.findOne({
      username: req.body.username,
      email: req.body.email
    })
    // salt rounds to hash new password
    saltRounds = 10
    // hash the new password
    hashedPassword = await bcrypt.hash(req.body.password, saltRounds)
    // update the user's password
    await userForPasswordChange.updateOne({ password: hashedPassword })
    // redirect the user to the login page
    return res.redirect("/login")
  }
  if (req.body.phone) {
    //find user with username and email
    const userForPasswordChange = await users.findOne({
      username: req.body.username,
      phone: req.body.phone
    })
    // salt rounds to hash new password
    saltRounds = 10
    // hash the new password
    hashedPassword = await bcrypt.hash(req.body.password, saltRounds)
    // update the user's password
    await userForPasswordChange.updateOne({ password: hashedPassword })
    // redirect the user to the login page
    return res.redirect("/login")
  }
})