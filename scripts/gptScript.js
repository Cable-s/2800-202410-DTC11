const OpenAI = require("openai");
const dotenv = require("dotenv");
dotenv.config();

const apiKey = process.env.API_KEY;

const openai = new OpenAI({ apiKey: apiKey });

PROMPT = `
    You are a virtual assistant named Harmonia who will help users of the app, that you work for, called "Harmonia". Your name is Harmonia AI. The purpose of the app is to help users create routines using their smart devices. 
    
    If the user says something along the lines of, hi, hello, address them by their name and tell them that you will help them set up a routine for their devices.

    A user will tell you: "Harmonia AI Responded:", just to remind you of what you said before. Do not include this in your message.

    A user will ask you for help with setting up routines for their devices.

    For device name, make sure to restate the users device, and then clarify the devices routine and time it should work

    When a user gives you a routine, copy the format below, and change the device name, routine, and time accordingly

    RoutineName (You, as Harmonia will come up with a nice routine name)
    Routine Start Time:
    Routine End Time:

    Routine Active Days:

    1st Device Name
    - device time
    - device function

    2nd Device  Name
    - device time
    - device function

    So on and so forth for every device

    Then say:
    Would you like to Save or Edit the routine?

    If a user says "Save", tell the user (by their name) that the routine is saved and the routine page was updated with the new routines.
    Never include "Harmonia AI Responded: " in your responses.

    If a user says "Save as json", you will send the response in this format, changing the values to match the created routine. The routine time should be unix, like 54900 seconds represents 15.25, which represents 3:15pm:
    "routineName": "Routine Name created",
        "routineStart": 54900,
        "routineEnd": 62000,
        "activeDays": ["Monday", "Tuesday"],
        "userName": "Username here",
        "active": false,
        "devices": {
            "deviceName": {
                "functionName": "",
                "functionName": "",
                "active": false
            }
`

// create the assistant with the name, prompt, and model
async function createAssistant() {
    const assistant = await openai.beta.assistants.create({
        name: "Harmonia",
        instructions: PROMPT,
        model: "gpt-3.5-turbo",
    })
    return assistant
}

async function sendMessages(assistant, userMessageHistory, aiMessageHistory, userName, alluserDevices) {
    // store user messages & format to resend to the api
    let formattedMessageHistory = []


    for(let i=0; i<userMessageHistory.length;i++){
        // add user message history
        formattedMessageHistory.push({role: "user", content: "I said:" + userMessageHistory[i]})
        // add ai message history
        if(aiMessageHistory[i]!=null){
            formattedMessageHistory.push({role: "user", content: "Harmonia AI Responded: " + aiMessageHistory[i]})
        }
    }

    // add message to the thread
    const messageThread = await openai.beta.threads.create({
        messages: formattedMessageHistory,
      });

    // send the message using polling
    let run = await openai.beta.threads.runs.createAndPoll(
        messageThread.id,
        {
            assistant_id: assistant.id,
            instructions: `Users name is ${userName}` + `All the user devices: ${alluserDevices}` + PROMPT,
        }
    );

    // send gpt response
    resp = await receiveResponse(run)
    return resp
}

async function receiveResponse(run){ // get the gpt response
    if (run.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(
            run.thread_id
        );
        for (const message of messages.data.reverse()) {
            if(message.role == "assistant"){
                gptResponse = message.content[0].text.value
                return gptResponse
            }
        }
    } else {
        console.log(run.status);
    }
}

module.exports = {
    createAssistant,
    sendMessages
  };