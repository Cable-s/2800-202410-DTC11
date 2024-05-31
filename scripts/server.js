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
const { parseSchema } = require("./getUserDevices.js");
const { readGptResponse, createRoutine } = require("./createRoutine.js");
const { updateRoutineActiveness } = require("./checkRoutine.js");
const cors = require("cors")

const app = express();
app.use(cors()) // for sending requests to the render site /sendMessage
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(bodyParser.json()); // for returning json responses in the /sendMessage endpoint

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

const routineSchema = new mongoose.Schema({
  routineName: String,
  routineStart: Number,
  routineEnd: Number,
  activeDays: Array,
  userName: String,
  active: Boolean,
  devices: Object
})

const Routine = mongoose.model('Routine', routineSchema);
const users = mongoose.model("2800users", userSchema);
const devices = mongoose.model("devices", deviceSchema);
const routines = mongoose.model("routines", routineSchema);

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
          functionValues[func] = 0
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

/*
* Home page
* Github Copilot extension helped writing the code for /home route overall by auto generating codes and comments
*
* @ GitHub Coilpot v1.197.0
*/
// Home page
app.get("/home", isAuthenticated, async (req, res) => {
  try {
    const username = req.session.user.username;

    // Find user's routines
    const routinesResult = await Routine.find({ userName: username });

    // Update the activeness of routines and devices directly within this route
    const now = new Date();
    const currentDay = now.toLocaleString('en-US', { weekday: 'long' }); // e.g., "Monday"
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds(); // current time in seconds since midnight

    const updatedRoutines = await Promise.all(routinesResult.map(async (routine) => {
      let isActive = false;

      // Check if today is an active day
      if (routine.activeDays.includes(currentDay)) {
        const routineStartSeconds = routine.routineStart;
        const routineEndSeconds = routine.routineEnd;

        // Handle routines that span midnight
        if (routineStartSeconds < routineEndSeconds) {
          // Routine within the same day
          isActive = routineStartSeconds <= currentSeconds && currentSeconds < routineEndSeconds;
        } else {
          // Routine crosses midnight
          isActive = routineStartSeconds <= currentSeconds || currentSeconds < routineEndSeconds;
        }
      }

      // Update routine activeness
      routine.active = isActive;

      // Update device activeness within the routine
      for (let deviceName in routine.devices) {
        routine.devices[deviceName].active = isActive;

        // Update device activeness in the devices collection
        await devices.updateOne(
          { deviceName, "users.username": routine.userName },
          { $set: { "users.$.activeness": isActive ? "on" : "off" } }
        );
      }

      await routine.save(); // Save routine updates to the database
      return routine;
    }));

    // Find user's devices
    const devicesResult = await devices.find({});
    const usersDevices = devicesResult.reduce((acc, device) => {
      const matchedUser = device.users.find(user => user.username === username);
      if (matchedUser) {
        const icon = getDeviceIcon(device.deviceName);
        acc.push({
          name: device.deviceName,
          icon: icon,
          matchedUser
        });
      }
      return acc;
    }, []);

    // Format the routines for rendering
    const usersRoutines = updatedRoutines.map(routine => ({
      name: routine.routineName,
      start: routine.routineStart,
      end: routine.routineEnd,
      days: routine.activeDays,
      active: routine.active
    }));

    res.render("home.ejs", { username, allUsersDevices: usersDevices, allUsersRoutine: usersRoutines });
  } catch (err) {
    res.status(500).send('Server error');
  }
});


// Icon mapping function
const deviceIcons = {
  tv: "fa-tv",
  lights: "fa-lightbulb",
  speaker: "fa-volume-up",
  clock: "fa-clock",
  blind: "fa-person-booth",
  coffeemachine: "fa-coffee",
  washingmachine: "fa-tint",
  car: "fa-car",
  kettle: "fa-coffee",
  fridge: "fa-snowflake",
  thermostat: "fa-thermometer-half",
  vacuumcleaner: "fa-robot",
  shower: "fa-shower",
  stove: "fa-fire",
  ringcamera: "fa-video",
  dishwasher: "fa-utensils",
  foodcooker: "fa-utensils",
  teslabot: "fa-robot",
  ac: "fa-solid fa-wind",
  default: "fa-question-circle",
};

/*
* Get device icon function
* Github Copilot extension helped writing the code for getDeviceIcon function overall by auto generating codes
*
* @ GitHub Coilpot v1.197.0
*/
// Function to get the icon class for a device
function getDeviceIcon(deviceName) {
  return deviceIcons[deviceName.toLowerCase()] || deviceIcons.default;
}

/*
* Room list page
* Github Copilot extension helped writing the code and comments for /roomList route overall by auto generating codes and comments
*
* @ GitHub Coilpot v1.197.0
*/
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
    res.status(500).send('Server error');
  }
});

/*
* Device Details page
* Github Copilot extension helped writing the code and comments for /deviceDetails route overall by auto generating codes and comments
*
* @ GitHub Coilpot v1.197.0
*/
// Device details page
app.get('/deviceDetails', isAuthenticated, async (req, res) => {
  try {

    // Get the username from the session
    const username = req.session.user.username;
    if (!username) {
      throw new Error('Username not found in session');
    }

    // Get the device name from the query parameters
    const deviceName = req.query.device;

    // Get the device name and username
    const device = await devices.findOne({ deviceName }).lean();
    if (!device) {
      return res.status(404).send('Device not found');
    }

    // Get the username from the session and match the username in the device's database
    const userDevice = device.users.find(user => user.username === username);
    if (!userDevice) {
      return res.status(404).send('User device not found');
    }

    // get thhe icon for the device
    const icon = getDeviceIcon(device.deviceName);
    device.icon = icon;

    res.render('deviceDetails', { device, userDevice });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

/*
* Control device function
* Github Copilot extension helped writing the code for and comments /updateDeviceFunction route overall by auto generating codes and to find the proper user index
*
* @ GitHub Coilpot v1.197.0
*/
app.post('/updateDeviceFunction', isAuthenticated, async (req, res) => {
  try {
    // Get the device name, function name, and function value from the request body
    const { deviceName, functionName, functionValue } = req.body;
    const username = req.session.user.username;

    // Check if the username is not found in the session
    if (!username) {
      throw new Error('Username not found in session');
    }

    // Find the device and user to ensure we are updating the correct fields
    const device = await devices.findOne({ deviceName, "users.username": username });

    // Find the user index. used to locate the position of the user within the users array based on the username
    // This helps creating the correct path to update within the users array
    const userIndex = device.users.findIndex(user => user.username === username);

    // Update the specific function value for the user
    const updateQuery = {};

    // Save the new function value to the user's functionValues object
    updateQuery[`users.${userIndex}.functionValues.${functionName}`] = functionValue;

    // Update the device with the new function value
    await devices.updateOne(
      { deviceName, "users.username": username },
      { $set: updateQuery }
    );

    // After updating the database, redirect the user back to the device details page
    res.redirect(`/deviceDetails?device=${deviceName}`);
  } catch (err) {
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
      text:
        `Harmonia 
      Hi ${userForRecovery.firstName}, you have requested a recovery code for your account
      Your recovery code is ${randomCode}
      Please do not reply to this email.
      Thanks
      © 2024 Harmonia. All Rights Reserved.
      `,
      // html body
      html:
        `
        <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Harmonia</title>
          <link rel="icon" type="image/x-icon" href="../images/app_logo.png" />
      
          <!-- our own scripts -->
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    primary: "#2D2B32",
                    secondary: "#B2EBF2",
                    background: "#222229",
                    accent: "white",
                  },
                },
              },
            };
          </script>
        </head>
      <body class="m-[5px]">
      <h1 style="display: flex; flex-direction: row; align-items: center;"><img width="40px" height="40px" src="https://two800-202410-dtc11-gyjq.onrender.com/app_logo.png"></img>Harmonia</h1><br><br>
      <p>Hi <b>${userForRecovery.firstName}</b>, you have requested a recovery code for your account</p>
      <p>Your recovery code is <b>${randomCode}</b></p>
      <br>
      <p>Please do not reply to this email.</p>
      <p>Thanks </p>
      <br>
        <!-- footer from tailwind https://flowbite.com/docs/components/footer/ with changes-->
      <footer class="bg-white rounded-lg shadow m-4">
        <div class="w-full mx-auto max-w-screen-xl p-4 md:flex md:items-center md:justify-between">
          <span class="text-sm text-gray-500 sm:text-center">© 2024 <a href="https://two800-202410-dtc11-gyjq.onrender.com/" class="hover:underline">Harmonia</a>. All Rights Reserved.
        </span>
        </div>
      </footer>
      
      
      </body>
      </html>
      `,
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

app.get("/devicesPage", isAuthenticated, (req, res) => {
  res.render("devicesPage.ejs");
});


app.get("/deviceRoutines", isAuthenticated, async (req, res) => {
  try {
    const routines = await Routine.find({ userName: req.session.user.username });
    const updatedRoutines = updateRoutineActiveness(routines);
    res.render("deviceRoutines", { routines: updatedRoutines });
  } catch (error) {
    res.status(404).send('Error fetching routines: ' + error.message);
  }
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

app.post('/create-routine', async (req, res) => {
  const { routineName, routineStart, routineEnd, activeDays, devices } = req.body;

  // Convert time to Unix timestamp (seconds since midnight). for example 1 am would be represented as 3600 and 1:30 am would be 5400
  const convertToUnixTimestamp = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60;
  };

  const routine = new Routine({
    routineName,
    routineStart: convertToUnixTimestamp(routineStart),
    routineEnd: convertToUnixTimestamp(routineEnd),
    activeDays: activeDays.split(','), // form is saved as Monday,Tuesday, etc.. so it must be split into an array before saved into mongo
    userName: req.session.user.username,
    active: false,
    devices: JSON.parse(devices) // Parse the devices JSON string
  });

  try {
    await routine.save();
    res.redirect('/deviceRoutines');
  } catch (error) {
    res.status(404).send('Error saving routine: ' + error.message);
  }
});

app.get("/editFunction", isAuthenticated, (req, res) => {
  res.render("editFunction.ejs");
});

app.post("/addConfiguredDevice", isAuthenticated, async (req, res) => {
  try {
    res.redirect("/createRoutine")
  } catch (error) {
    console.error("Error updating device:", error);
    res.status(500).send("Server error");
  }
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
  // the users username
  let userName = req.session.user.username
  // the message a user sends
  message = req.body.message

  // store all the users messages in an array
  userMessageHistory.push(message)

  // store the created assistant
  assistant = await createAssistant()

  gptResponse = await sendMessages(assistant, userMessageHistory, aiMessageHistory, userName, alluserDevices)


  // store ai responses
  aiMessageHistory.push(gptResponse)
  // output the responses as a json (to the user sending the request)
  res.json(gptResponse)

  // if the user says save, save the value as json
  if (message.toLowerCase().includes("save")) {
    // invoke the ai to save the value as a json
    userMessageHistory.push("Save as json")
    gptResponseJson = await sendMessages(assistant, userMessageHistory, aiMessageHistory, userName, alluserDevices)
    try {
      newRoutine = await readGptResponse(gptResponseJson, userName)
      createRoutine(newRoutine, routines)
    } catch (err) {
      console.log(err)
    }

  }
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

app.get("/addDevice", isAuthenticated, async (req, res) => {
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
    res.render('addDevice', { devicesGrouped, classifyBy });

  } catch (err) {
    // Handle any errors that occur during the process
    console.error('Error fetching devices:', err);
    res.status(404).send('Server error');
  }
})

app.post("/addDevice", isAuthenticated, async (req, res) => {
  res.render("configureDeviceRoutine.ejs", {
    formData: req.body,
    devices: await devices.find({ deviceName: req.body.deviceName }),
  })
})

app.get('/editDevicePage', isAuthenticated, async (req, res) => {
  try {
    const deviceName = req.query.deviceName;
    console.log('Device name received:', deviceName); // Log the device name received
    const device = await devices.find({ deviceName: deviceName });
    console.log('Device found:', device); // Log the device found
    if (device.length > 0) {
      res.render('editDeviceRoutine', { devices: device });
    } else {
      res.status(404).send('Device not found');
    }
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).send('Server error');
  }
});

app.post('/updateDevice', isAuthenticated, async (req, res) => {
  try {
    const { deviceName, ...updatedValues } = req.body;
    console.log('Updated values:', updatedValues);
    res.redirect('/createRoutine');
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(404).send('Server error');
  }
});



// 404 catch route
app.get("*", (req, res) => {
  res.render("404.ejs")
})
