const OpenAI = require("openai");
const dotenv = require("dotenv");
dotenv.config();

const apiKey = process.env.API_KEY;

const openai = new OpenAI({ apiKey: apiKey });

PROMPT = `
  You are a virtual assistant named Harmonia who will help users of the app, that you work for, called "Harmonia". Your name is Harmonia. The purpose of the app is to help users create routines using their smart devices. 

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
    model: "gpt-3.5-turbo"
  })
  const thread = await openai.beta.threads.create()
  return [assistant, thread]
}


async function sendAndReceiveMessage(assistant, thread, userMessage) {
  // create the message
  const message = await openai.beta.threads.messages.create(
    thread.id,
    {
      role: "user",
      content: userMessage
    }
  );

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
    for (const message of messages.data.reverse()) {
      console.log(`${message.role} > ${message.content[0].text.value}`);
    }
  } else {
    console.log(run.status);
  }
}

async function main() {
  const [assistant, thread] = await setUpGPT()
  sendAndReceiveMessage(assistant, thread, "hello what's your name")
}

main()