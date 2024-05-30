// append all messages (ai/user) 
const appendMessageArea = document.getElementById("messages-here")

// create a copy of this for each user message
const userMessageDiv = document.getElementById("user-message-template")
const aiMessageDiv = document.getElementById("ai-message-template")

async function fetchUserMessage(){
    const submitButton = document.getElementById("submit-user-message")

    // should send the request here
    // should append the message here
    submitButton.addEventListener("click", async ()=>{ 
        // add the user message to the front end
        let messageValue = document.getElementById("user-input").value
        appendUserMessage(messageValue)

        // send the post request to the /send-message EP to get the gpt response
        let gptResponse = (await axios.post("http://localhost:3000/sendMessage", { // change the EP to where the site is hosted
            message: messageValue
        })).data
        appendAiMessage(gptResponse)
        // when the button is pressed, send the post request to the /send-message EP with the payload being the messageValue
        // the /send-message EP should call the sendAndReceiveMessage in the gptScript.js file
        // the /send-message EP should return the response of the gpt message, which will be passed as a parameter to the appendAiMessage function
    })
}

function appendUserMessage(message){
    const userMessageClone = userMessageDiv.cloneNode(true) // true copies the descendants
    userMessageClone.toggleAttribute("hidden")
    userMessageClone.querySelector("#user-message-here").innerHTML = message

    // append to the message box
    appendMessageArea.appendChild(userMessageClone)
}

function appendAiMessage(message){
    console.log(message)
    const aiMessageClone = aiMessageDiv.cloneNode(true) // true copies the descendants
    aiMessageClone.toggleAttribute("hidden")
    aiMessageClone.querySelector("#ai-message-here").innerHTML = message

    // append to the message box
    appendMessageArea.appendChild(aiMessageClone)
}

function main(){
    fetchUserMessage()
}

main()