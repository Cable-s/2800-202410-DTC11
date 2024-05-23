const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const ejs = require("ejs");
const bcrypt = require("bcrypt");
const { Db } = require("mongodb");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

main().catch((err) => console.log(err));

async function main() {
  username = process.env.DB_USERNAME;
  password = process.env.DB_PASSWORD;
  host = process.env.DB_HOST;
  database = process.env.DB_DATABASE;
  await mongoose.connect(
    `mongodb+srv://${username}:${password}@${host}/${database}`
  );

  app.listen(process.env.PORT || 3000, () => {
    console.log("Server is running");
  });
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: process.env.MAILER_USER,
    pass: process.env.MAILER_PASS,
  },
});

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  phone: String,
  password: String,
  firstName: String,
  lastName: String,
});

const deviceSchema = new mongoose.Schema({
  category: String,
  deviceFunctions: Object,
  deviceName: String,
  room: String,
  routineId: String,
  userId: mongoose.Schema.Types.ObjectId,
  activeness: String
});

const users = mongoose.model("2800users", userSchema);
const devices = mongoose.model("devices", deviceSchema);

// create the session/cookie
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: `mongodb+srv://${username}:${password}@${host}/${database}`,
    }), // Store session in MongoDB
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

app.use(express.static("public"));

// change this to the homepage
app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/signUp", (req, res) => {
  res.render("signUp.ejs", {
    error: req.query.error,
  });
});

app.post("/signUp", async (req, res) => {
  if (req.body.password == req.body.repeat_password) {
    saltRounds = 10;
    hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
    const user = new users({
      username: req.body.username,
      email: req.body.email,
      phone: req.body.phone,
      password: hashedPassword,
      name: req.body.firstName,
      lastName: req.body.lastName,
    });

    req.session.user = {
      username: req.body.username,
      email: req.body.email,
      phone: req.body.phone,
    }; // Store user information in session

    createdUser = await users.create({
      username: req.body.username,
      email: req.body.email,
      phone: req.body.phone,
      password: hashedPassword,
      name: req.body.firstName,
      lastName: req.body.lastName,
    });
  } else {
    return res.redirect("/signUp?error=passwords_dont_match");
  }
  res.redirect("/login");
});

// app.get("/index", (req, res) => {
//   res.render("index")
// })

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post("/login", async (req, res) => {
  usersUsername = req.body.username;
  usersPassword = req.body.password;

  // Check if the email is in the database
  try {
    const user = await users.findOne({
      username: usersUsername,
    });

    if (user) {
      await bcrypt.compare(usersPassword, user.password, (err, result) => {
        // Check if the entered password is the same as the stored password
        if (result) {
          req.session.authenticated = true; // authentication here
          req.session.user = {
            username: user.username,
            email: user.email,
            phone: user.phone,
          }; // Store user information in session
          return res.redirect("/home");
        } else {
          res.status(401).send("Invalid password");
        }
      });
    } else {
      res.status(401).send("User not found");
    }
  } catch (err) {
    return res.status(500).send("Server error page here. Status code 500"); // change
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/index");
});

// middleware for authentication check
function isAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect("/login");
}

// Home page
app.get("/home", isAuthenticated, (req, res) => {
  res.render("home");
});

// Icon mapping function
const deviceIcons = {
  tv: "fa-tv",
  lights: "fa-lightbulb",
  speaker: "fa-volume-up",
  clock: "fa-clock",
  blind: "fa-blinds",
  coffeemachine: "fa-coffee",
  washingmachine: "fa-tint",
  car: "fa-car",
  kettle: "fa-coffee",
  fridge: "fa-snowflake",
  thermostat: "fa-thermometer-half",
  vacumcleaner: "fa-robot",
  shower: "fa-shower",
  stove: "fa-fire",
  ringcamera: "fa-video",
  dishwasher: "fa-utensils",
  foodcooker: "fa-utensils",
  teslabot: "fa-robot",
  default: "fa-question-circle",
};

function getDeviceIcon(deviceName) {
  return deviceIcons[deviceName.toLowerCase()] || deviceIcons.default;
}

app.get('/roomList', isAuthenticated, async (req, res) => {
  try {
    // Get the username from the session
    const username = req.session.user.username;

    // Check if the username is not found in the session
    if (!username) {
      throw new Error('Username not found in session');
    }

    // Default to 'room' when enter the roomList page
    const { classifyBy = 'room' } = req.query;
    let filter = { username };

    // Find user's devices from the database
    const userDevices = await devices.find(filter);

    // Store devices by room or category or activeness
    let devicesByCategory = {};

    // CHeck if the classifyBy is set to 'category'
    if (classifyBy === 'category') {
      // Group devices by category using .reduce()
      devicesByCategory = userDevices.reduce((acc, device) => {
        const icon = getDeviceIcon(device.deviceName);
        device.icon = icon;
        // if the category is not in the accumulator, make it empty
        if (!acc[device.category]) {
          acc[device.category] = [];
        }
        // Push the device to the category
        acc[device.category].push(device);
        return acc;
      }, {});
      // Render the roomList page with classiried devices by category
      res.render('roomList', { devicesByCategory, classifyBy });
      // Check if the classifyBy is set to 'activeness'
    } else if (classifyBy === 'activeness') {
      // Group devices by status using .reduce()
      devicesByCategory = userDevices.reduce((acc, device) => {
        const icon = getDeviceIcon(device.deviceName);
        device.icon = icon;
        if (!acc[device.activeness]) {
          // if the activeness is not in the accumulator, make it empty
          acc[device.activeness] = [];
        }
        // Push device to the activeness
        acc[device.activeness].push(device);
        return acc;
      }, {});
      res.render('roomList', { devicesByCategory, classifyBy });
      // Else, group devices by room
    } else {
      // Group devices by room using .reduce()
      const devicesByRoom = userDevices.reduce((acc, device) => {
        const icon = getDeviceIcon(device.deviceName);
        device.icon = icon;
        if (!acc[device.room]) {
          acc[device.room] = [];
        }
        acc[device.room].push(device);
        return acc;
      }, {});
      res.render('roomList', { devicesByRoom, classifyBy: 'room' });
    }
    // Catch errors
  } catch (err) {
    console.error('Error fetching devices:', err);
    res.status(500).send('Server error');
  }
});

// the password recovery route
app.get("/recovery", (req, res) => {
  res.render("recovery.ejs");
});

// the password recovery form post route
app.post("/recovery", async (req, res) => {
  // if the user is using email to recover
  //find user with username and email
  const userForRecovery = await users.findOne({
    username: req.body.username,
  });
  // if the user is found
  if (userForRecovery) {
    // generate a random code
    let randomCode = Math.floor(100000 + Math.random() * 900000);
    // send the email
    await transporter.sendMail({
      // from harmonia gmail account
      from: '"Harmonia" <harmonia2800@gmail.com>',
      //to user email
      to: userForRecovery.email,
      // subject line
      subject: "password recovery",
      //plain text body
      text: `Your recovery code is ${randomCode}`,
      // html body
      html: `<p>Your recovery code is <b>${randomCode}</b></p>`,
    });
    //render newPassword page and send info to change password
    res.render("newPassword", {
      username: req.body.username,
      email: userForRecovery.email,
      phone: "",
      code: randomCode,
    });
    //if no user is found
  } else {
    // send a message to the user
    return res.send("User not found");
  }
});

// the password recovery form post route
app.post("/replacePassword", async (req, res) => {
  // if the user is using email to recover
  //find user with username and email
  const userForPasswordChange = await users.findOne({
    username: req.body.username,
  });
  // salt rounds to hash new password
  saltRounds = 10;
  // hash the new password
  hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
  // update the user's password
  await userForPasswordChange.updateOne({ password: hashedPassword });
  // redirect the user to the login page
  return res.redirect("/login");
});

app.get("/profile", isAuthenticated, (req, res) => {
  if (!req.session.authenticated) {
    // If the user is not authenticated, redirect them to the home page
    res.redirect("/login");
    return;
  }

  // Get the user's name from the session
  const userName = req.session.user.username;
  console.log(userName);
  const userEmail = req.session.user.email;
  const userPhone = req.session.user.phone;
  // const userPhonenumber = req.session.user.phonenumber;
  res.render("profilePage.ejs", {
    userName,
    userEmail,
    userPhone,
  });
});

app.get("/connectedRooms", isAuthenticated, (req, res) => {
  res.render("connectedRooms.ejs");
});

app.get("/devicesPage", isAuthenticated, (req, res) => {
  res.render("devicesPage.ejs");
});

app.get("/deviceRoutines", isAuthenticated, (req, res) => {
  res.render("deviceRoutines.ejs");
});

app.get("/createRoutine", isAuthenticated, (req, res) => {
  res.render("createRoutine.ejs");
});

app.get("/editRoutines", isAuthenticated, (req, res) => {
  res.render("editRoutines.ejs");
});

allUsersMessages = [];
app.get("/harmonia-dm", isAuthenticated, (req, res) => {
  res.render("chatbot.ejs", { allUsersMessages: allUsersMessages });
});

app.post("/sendMessage", isAuthenticated, (req, res) => {
  allUsersMessages.push(req.body.message);
  res.redirect("/harmonia-dm");
});

module.exports = app;