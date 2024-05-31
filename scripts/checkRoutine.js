const updateRoutineActiveness = (routines) => {
    const now = new Date();
    const currentDay = now.toLocaleString('en-US', { weekday: 'long' }); // e.g., "Monday"
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds(); // current time in seconds since midnight

    routines.forEach(routine => {
        // check if today is an active day
        if (!routine.activeDays.includes(currentDay)) {
            routine.active = false;
            return;
        }

        // check if the current time is between the start and end times
        const routineStartSeconds = routine.routineStart;
        const routineEndSeconds = routine.routineEnd;

        // Handle routines that span midnight
        if (routineStartSeconds < routineEndSeconds) {
            // routine within the same day
            routine.active = routineStartSeconds <= currentSeconds && currentSeconds < routineEndSeconds;
        } else {
            // routine crosses midnight
            routine.active = routineStartSeconds <= currentSeconds || currentSeconds < routineEndSeconds;
        }
    });

    return routines;
};

module.exports = { updateRoutineActiveness };