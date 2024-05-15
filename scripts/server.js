const express = require('express')
const mongoose = require('mongoose')
const dotenv = require('dotenv').config();
const ejs = require('ejs')
const bcrypt = require('bcrypt')
const { Db } = require('mongodb');
const session = require('express-session')

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
  email: String,
  name: String,
  password: String,
})

const deviceSchema = new mongoose.Schema({
  name: String,
})

const users = mongoose.model('2800users', userSchema)
const devices = mongoose.model('devices', deviceSchema)

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))

// change this to the homepage
app.get("/", (req, res)=>{
  res.redirect("/signUp")
})

app.get("/signUp", (req, res) =>{
  res.render("signUp")
})

app.post("/signUp", async (req, res)=>{
  saltRounds = 10
  hashedPassword = await bcrypt.hash(req.body.password, saltRounds)
  createdUser = await users.create({email: req.body.email, name: req.body.username, password: hashedPassword})

  res.redirect("/login")
})

app.get("/login", (req, res)=>{
  res.render("login")
})

app.post("/login", async (req, res)=>{
  usersUsername = req.body.username
  usersPassword = req.body.password

  const user = await users.findOne({
    name: usersUsername
  })

  if(user) {
    bcrypt.compare(usersPassword, user.password, (err, result) =>{
      // authentication here
      req.session.authenticated = true
      console.log("passwords are the same!")
      return res.redirect("homePage")
    })
  } else{
    return res.send("Not authenticated page here").status(401)
  }
})

// unprotected route
app.get("/homePage", (req, res)=>{
  res.send("some home page here")
})