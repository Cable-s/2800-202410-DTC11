const updateRoutineActiveness = (routines) => {
    const now = new Date();
    const currentDay = now.toLocaleString('en-US', { weekday: 'long' }); // e.g., "Monday"
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds(); // current time in seconds since midnight

    routines.forEach(routine => {
        // Check if today is an active day
        if (!routine.activeDays.includes(currentDay)) {
            routine.active = false;
            return;
        }

        // Check if the current time is between the start and end times
        const routineStartSeconds = parseInt(routine.routineStart.split(':')[0]) * 3600 + parseInt(routine.routineStart.split(':')[1]) * 60;
        const routineEndSeconds = parseInt(routine.routineEnd.split(':')[0]) * 3600 + parseInt(routine.routineEnd.split(':')[1]) * 60;

        routine.active = routineStartSeconds <= currentSeconds && currentSeconds < routineEndSeconds;
    });

    return routines;
};

module.exports = { updateRoutineActiveness };