# BeatSaber Rank Bot
A bot created for the Finnish Beat Saber community discord Tahti Sapeli.
Does various things such as tracks peoples scores, gives roles on their rank and other utility/safety features.

## Running the bot locally
### Setting the bot up from Discord API
Go to the [Discord developer portal](https://discord.com/developers/). Setup the bot as an application and as a bot instance. Copy `exampleconfig.json` to `config.json` and fill out `application id` and `public (secret) key`. Add your `token` from the bot instance page and fill it to the corresponding key. From the server you are going to test (or use) the bot, get the serverid (`guildid`) and admin channel ID (`adminchannelID`). 
### Setting the bot up locally
You can find these ids from checking the link to the admin channel. First directory is the id of the server and the 2nd id is of the channel. You also need a local ([guide](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/)) or remote MongoDB server. Add the mongourl of your server in mongourl like so: `mongodb://<url>:<port>`. Also add a name for your collection under `dbName`. Also add your preferred prefix character with `prefix`. 
### Starting the bot up locally
This bot uses Node.js. You can download it to Windows from [here](https://nodejs.org/en/download/) or to Linux using your package manager. If you haven't installed the required node_modules, run:
```
npm install
```
To start the bot, run:
```
node index.js
```

## Contact the developer
Message the developer on discord Make#6000 if you have any questions.
