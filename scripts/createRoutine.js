function readGptResponse(message, userName){
    // format the ai response to be json
    let newRoutine = message.replace("```json", "")
    newRoutine = JSON.parse(message)
    newRoutine[userName] = userName
    return newRoutine
}

async function createRoutine(newRoutine, devices){
    console.log(newRoutine)
    createdRoutine = await devices.create(newRoutine)
    
}

module.exports = {readGptResponse, createRoutine}