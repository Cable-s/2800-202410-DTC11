const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const ejs = require("ejs");
const bcrypt = require("bcrypt");
const { Db } = require("mongodb");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const nodemailer = require("nodemailer");
const path = require("path")
const bodyParser = require('body-parser');
const { createAssistant, sendMessages } = require("./gptScript.js");
const { parseSchema} = require("./getUserDevices.js");


const app = express();
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(bodyParser.json()); // for the /sendMessage endpoint

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
  activeness: String,
  users: Array
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
    userExists = await users.findOne({ username: req.body.username })
    if (userExists) {
      return res.redirect("/signUp?error=user_exists");
    }
    saltRounds = 10;
    hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
    const user = new users({
      username: req.body.username,
      email: req.body.email,
      phone: req.body.phone,
      password: hashedPassword,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
    });


    devices.find({}).then((result) => {
      result.forEach((device) => {
        let functionValues = {}
        Object.keys(device.deviceFunctions).forEach((func) => {
          functionValues[func] = "0"
        })
        device.users.push({
          "activeness": "off",
          "room": "",
          "functionValues": functionValues,
          "routineID": "",
          "username": req.body.username
        })
        device.save()
      })
    })

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
      firstName: req.body.firstName,
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
            firstName: user.firstName,
            lastName: user.lastName,
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
  res.redirect("/");
});

// middleware for authentication check
function isAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect("/login");
}

// Home page
app.get("/home", isAuthenticated, async (req, res) => {
  let usersDevices = new Array()
  let username = req.session.user.username;
  console.log(username);
  
  devices.find({}).then(async (result) => {
    result.forEach(async (device) => {
      console.log(device.deviceName)

      const matchedUser = await device.users.find(user => user.username === username);
      if (matchedUser != undefined && matchedUser.username == username) {
        const icon = getDeviceIcon(device.deviceName);
        usersDevices.push({
          name: device.deviceName,
          icon: icon,
          matchedUser
        })
      }
    })

    
    const allUsersDevices = await usersDevices
    // console.log(allUsersDevices)
    res.render("home.ejs", {allUsersDevices}); 
  })
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

// Function to get the icon class for a device
function getDeviceIcon(deviceName) {
  return deviceIcons[deviceName.toLowerCase()] || deviceIcons.default;
}

// Room list page
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

    // Find user's devices from the database
    const userDevices = await devices.find({}).lean();

    // Store devices by room or category or activeness
    let devicesGrouped = {};

    // Iterate over each device and group them based on the classifyBy parameter
    userDevices.forEach(device => {
      // Check if the device has users and filter the user array
      const matchedUser = device.users.find(user => user.username === username);

      if (matchedUser) {
        // Get the icon for the device
        const icon = getDeviceIcon(device.deviceName);
        device.icon = icon;

        // CHeck if the classifyBy is set to 'category'
        if (classifyBy === 'category') {
          if (!devicesGrouped[device.category]) {
            devicesGrouped[device.category] = [];
          }
          // JS spread operator to merge properties from two objects into a new object, which is then added to an array
          devicesGrouped[device.category].push({ ...device, ...matchedUser });

          // Group devices by activeness
        } else if (classifyBy === 'activeness') {
          if (!devicesGrouped[matchedUser.activeness]) {
            devicesGrouped[matchedUser.activeness] = [];
          }
          devicesGrouped[matchedUser.activeness].push({ ...device, ...matchedUser });

          // Default grouping by room
        } else {
          if (!devicesGrouped[matchedUser.room]) {
            devicesGrouped[matchedUser.room] = [];
          }
          devicesGrouped[matchedUser.room].push({ ...device, ...matchedUser });
        }
      }
    });

    // Render the roomList page with the grouped devices
    res.render('roomList', { devicesGrouped, classifyBy });

  } catch (err) {
    // Handle any errors that occur during the process
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
  const firstName = req.session.user.firstName;
  console.log(firstName)
  const lastName = req.session.user.lastName;
  console.log(lastName);
  const userEmail = req.session.user.email;
  const userPhone = req.session.user.phone;
  // const userPhonenumber = req.session.user.phonenumber;
  res.render("profilePage.ejs", {
    userName,
    firstName,
    lastName,
    userEmail,
    userPhone,
  });
});

app.get("/connectedRooms", isAuthenticated, (req, res) => {
  let userDeviceRooms = new Array()
  let username = req.session.user.username;
  console.log(username);
  
  devices.find({}).then(async (result) => {
    result.forEach(async (device) => {
      console.log(device.deviceName)

      const matchedUser = await device.users.find(user => user.username === username);
      if (matchedUser != undefined && matchedUser.username == username) {
        console.log(matchedUser)
        userDeviceRooms.push(matchedUser.room)
      }
    })
    
    const allUsersRooms = await userDeviceRooms
    console.log(allUsersRooms)
    res.render("connectedRooms.ejs", {allUsersRooms});
  });
});

app.post("/connectedRooms", async (req, res) => {
  const selectedRoom = req.body.room;
  console.log(selectedRoom);
})

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

app.get("/deviceInfo", isAuthenticated, (req, res) => {
  res.render("deviceInfo.ejs");
});

app.get("/createFunction", isAuthenticated, (req, res) => {
  res.render("createFunction.ejs");
});

const routineSchema = new mongoose.Schema({
  routineName: String,
  routineStart: String,
  routineEnd: String,
  activeDays: [String], // array of weekdays that the device will be active for e.g., ["Monday", "Wednesday", "Friday"]
  userName: String
});

const Routine = mongoose.model('Routine', routineSchema);

app.post('/create-routine', async (req, res) => {
  const { routineName, routineStart, routineEnd, activeDays } = req.body;

  // Convert time to Unix timestamp (seconds since midnight). for example 1 am would be represented as 3600 and 1:30 am would be 5400
  const convertToUnixTimestamp = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60;
  };

  const routine = new Routine({
    routineName,
    routineStart: convertToUnixTimestamp(routineStart),
    routineEnd: convertToUnixTimestamp(routineEnd),
    activeDays: activeDays.split(','), //form is saved as Monday,Tuesday, etc.. so it must be split into an array before saved into mongo
    userName: req.session.user.username
  });

  try {
    await routine.save();
    res.redirect('/deviceRoutines');
  } catch (error) {
    res.status(500).send('Error saving routine: ' + error.message);
  }
});

app.get("/editFunction", isAuthenticated, (req, res) => {
  res.render("editFunction.ejs");
});

app.get("/harmonia-dm", isAuthenticated, async (req, res) => {
  let userName = req.session.user.username // the users username
  alluserDevices = await parseSchema(devices, userName)
  chatBotPath = path.join(__dirname, '..', 'views', 'chatBot.html');
  res.sendFile(chatBotPath)
});

let userMessageHistory = []
let aiMessageHistory = []

app.post("/sendMessage", isAuthenticated, async (req, res) => {
  let userName = req.session.user.username // the users username
  message = req.body.message // the message a user sends
  userMessageHistory.push(message) // store all the users messages in an array

  assistant = await createAssistant() // store the created assistant

  gptResponse = await sendMessages(assistant, userMessageHistory, aiMessageHistory, userName, alluserDevices)
  aiMessageHistory.push(gptResponse)

  res.json(gptResponse)
});

//hidden admin route for beginning of the easter egg
app.get("/hidden", isAuthenticated, (req, res) => {
  res.render("admin.ejs")
});

// post route for the admin route when finding the hidden button
app.post("/hidden", isAuthenticated, async (req, res) => {
  res.render("foundit.ejs")
})

app.get("/lights", (req, res) => {
  res.render("lights.ejs")
})

app.get("/coffeemachine", (req, res) => {
  res.render("coffeemachine.ejs")
})

// 404 catch route
app.get("*", (req, res) => {
  res.render("404.ejs")
})