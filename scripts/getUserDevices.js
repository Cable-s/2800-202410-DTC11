async function parseSchema(devices, userName) {
    let allUserDevices = []
    const userDevices = await devices.find({}).lean();

    userDevices.forEach(device => {
        // Check if the device has users and filter the user array
        const matchedUser = device.users.find(user => user.username === userName);

        if (matchedUser) {
            // Get the icon for the device
            allUserDevices.push(device.deviceName)
        }
    })
    return allUserDevices
}

module.exports = {
    parseSchema
}