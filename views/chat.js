console.log(111111111111111)
// append all messages (ai/user) 
const appendMessageArea = document.getElementById("messages-here")

// create a copy of this for each user message
const userMessageDiv = document.getElementById("user-message-template")

function fetchUserMessage(){
    const submitButton = document.getElementById("submit-user-message")

    // should send the request here
    // should append the message here
    submitButton.addEventListener("click", ()=>{ 
        let messageValue = document.getElementById("user-input").value
        appendUserMessage(messageValue)
    })
}

function appendUserMessage(message){
    const userMessageClone = userMessageDiv.cloneNode(true) // true copies the descendants
    userMessageClone.toggleAttribute("hidden")
    userMessageClone.querySelector("#user-message-here").innerHTML = message

    // append to the message box
    appendMessageArea.appendChild(userMessageClone)
}

function main(){
    fetchUserMessage()
}

main()