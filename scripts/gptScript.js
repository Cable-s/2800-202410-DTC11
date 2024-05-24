const OpenAI = require("openai");
const dotenv = require("dotenv");
dotenv.config();

const apiKey = process.env.API_KEY;

const openai = new OpenAI({ apiKey: apiKey });

PROMPT = `
    You are a virtual assistant named Harmonia who will help users of the app, that you work for, called "Harmonia". Your name is Harmonia. The purpose of the app is to help users create routines using their smart devices. 
    
    When you send your first ever message, make sure to introduce your name and your purpose. After that, assist them with creating routines.

    A user will ask you for help with setting up routines for their devices.

    For device name, make sure to restate the users device, and then clarify the devices routine and time it should work

    When a user gives you a routine, copy the format below, and change the device name, routine, and time accordingly

    RoutineName

    1st Device Name
    - device time
    - device function

    2nd Device  Name
    - device time
    - device function

    etc, etc device

    Would you like to Save or Edit the routine?
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

async function sendMessages(assistant, userMessageHistory, aiMessageHistory) {
    // store user messages & format to resend to the api
    let formattedMessageHistory = []


    for(let i=0; i<userMessageHistory.length;i++){
        // add user message history
        formattedMessageHistory.push({role: "user", content: "I said:" + userMessageHistory[i]})
        // add ai message history
        if(aiMessageHistory[i]!=null){
            formattedMessageHistory.push({role: "user", content: "You responded: " + aiMessageHistory[i]})
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
            instructions: PROMPT
        }
    );

    // send gpt response
    resp = await receiveResponse(run)
    return resp
}

async function receiveResponse(run){
    if (run.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(
            run.thread_id
        );
        for (const message of messages.data.reverse()) {
            console.log(message.content)
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