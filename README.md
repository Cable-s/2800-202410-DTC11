# Harmonia
### description
In our fast-paced world, where we increasingly depend on technology, our Smart Home Automation app simplifies life by integrating all your smart devices into one platform with a personalized virtual assistant to streamline device management and daily routines.
### technology used

#### frontend
- Tailwind CSS
- EJS

#### backend
- Express.js
- BCrypt
- Body Parser
- Mongo
- Mongoose
- Cors
- DotENV
- Node
- Node Mailer
- Nodemon
- OpenAI

#### Database
- Mongo Atlas

### listing of File Contents of folder
dont know what this means

### How to install / run
#### languages used
- HTML
- CSS
- Tailwind CSS CDN
- EJS
- JavaScript

#### IDE and other programs
- We use VS Code for coding and merge conflicts
	- other programs may be used if preferred
- Communication with team members is done through Discord

#### Database
- The database is on Mongo Atlas
- there are 3 collections on the database
	1. Users
		- A collection of user data that is collected when the user signs up
	2. Devices
		- A collection of the devices the user has.
			- stores info about that device like what room it is in and it parameters that can be edited by the user
		- A collection of the routines the user can make

#### Standards for Work
- We use Gitflow Workflow 
	- the *dev* branch branches off of the *main* branch. The dev branch is used for integration testing before merging to main
	- *Feature branches* branch off of *dev*. Feature Branches is where you will make new features for the app.
	- We do not branch off of feature branches for this project
	- The only branch off of main is the dev branch for this project
- Each new webpage must be created using EJS and tailwind
	- exception can be made for specific applications like querying the DOM elements
	- EJS files must go into the *views* folder
	- External JS files must go into the *Scripts* folder
- Variables and file names use camelCase

#### Start work in VS Code
1. install VS Code
2. copy HTTPS .git link from repo (https://github.com/cajzc/2800-202410-DTC11.git)
3. in cmd
   - `cd *Your File Path*`
   - `git clone https://github.com/cajzc/2800-202410-DTC11.git`
   - `git code .`

4. in VS Code. get all dependencies

	open the terminal with CTRL + \` and type `npm install`

6. Get the .env file from a team member
	1. create a file called `.env` 
	2. the .env file contain **secrets** that are required for the app to run, and we **do not want those public**
	3. The .env file has to be in the highest level folder

7. create a feature branch
	1. make sure you are on the *dev* branch with `git checkout dev` or check the bottom right in VS Code to see what branch you are in[![Checking branch](https://cdn.discordapp.com/attachments/1060777468925071511/1245879209726050304/image.png?ex=665a5aee&is=6659096e&hm=fb855f91ca5b471f744c734f39be8c5c908549212ee51c2ce4b538e2faa572d8& "Checking branch")](https://cdn.discordapp.com/attachments/1060777468925071511/1245879209726050304/image.png?ex=665a5aee&is=6659096e&hm=fb855f91ca5b471f744c734f39be8c5c908549212ee51c2ce4b538e2faa572d8& "Checking branch")
	2. Create a new branch
		in VS Code PowerShell type `git checkout -b *featureBranchName* dev`

	3. Upstream the branch to the repo using 
	`git push -u origin *featureBranchName*`
2. Code whatever you need to work on
	- Note: Commit and push often using these commands in the terminal
		1. `git add .`
		2. `git commit -m "*commit_message*"`
		3. `git push`
3. Once you are done with your changes you are ready to push to dev

	6. Switch to the dev branch using `git checkout dev`

	7. Merge the branches using `git merge *featureBranchName*`

	8. Deal with merge conflicts if there are any
		- if you are unsure about anything envolving merge conflict please ask a team member

	9. push changes using `git push`

### References
Each time external help is used for this project, a reference will be put here and in the source code where it was used.
- Tailwind Documentation https://tailwindcss.com/ was used throughout the project
- Stack Overflow https://stackoverflow.com/ was used for debugging and problem solving
- ChatGPT https://chat.openai.com/ was used for debugging and problem solving

### AI (CAINAN ANSWER THESE)
- Did you use AI to help create your app? If so, how? Be specific
- DId you use AI to create data sets or clean data sets? If so, how? Be specific.
- Does your app use AI? If so, how? Be specific.
- Did you encounter any limitations? What were they, and how did you overcome them? Be specific.

### Contact Information
Caleb Janzen:
- Email: caleb.s.janzen@gmail.com
- Discord: cable_s

*other team members:*
