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

async function setUpGPT() {
    const assistant = await openai.beta.assistants.create({
        name: "Harmonia", // doesn't work here
        instructions: PROMPT, // doesn't work here
        model: "gpt-3.5-turbo",
    })
    const thread = await openai.beta.threads.create()
    return [assistant, thread]
}

async function sendAndReceiveMessage(assistant, thread, allUserMessages) {
    allUserMessages.forEach( async (messages)=>{ // create a thread for every single users message
        const message = await openai.beta.threads.messages.create(
            thread.id,
            {
                role: "user",
                content: messages 
            }
        );

    })

    // create the message

    // send the message using polling
    let run = await openai.beta.threads.runs.createAndPoll(
        thread.id,
        {
            assistant_id: assistant.id,
            instructions: PROMPT
        }
    );

    // await the message response
    if (run.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(
            run.thread_id
        );
        for (const message of messages.data.reverse()) { // error looks like its here
            // console.log(messages.data)
            console.log(message.content)
            if(message.role == "assistant"){
                console.log(message.content[0].text.value)
                return message.content[0].text.value
            }
        }
    } else {
        console.log(run.status);
    }
}

module.exports = {
    setUpGPT,
    sendAndReceiveMessage
  };