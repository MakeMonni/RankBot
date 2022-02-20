# BeatSaber Rank Bot
A bot created for the Finnish Beat Saber community discord Tahti Sapeli.
Does various things such as tracks peoples scores, gives roles on their rank and other utility/safety features.

## Running the bot locally
### Setting the bot up from Discord API
Go to the [Discord developer portal](https://discord.com/developers/). Setup the bot as an application and as a bot instance. Fill out `exampleconfig.json` with the `application id` and `public (secret) key`, also add your `token` from the bot instance page. From the server you are going to test (or use) the bot, get the serverid (`guildid`) and admin channel ID (`adminchannelID`). 
### Setting the bot up locally
You can find these ids from checking the link to the admin channel. First directory is the id of the server and the 2nd id is of the channel. You also need a local ([guide](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/)) or remote MongoDB server. Add the mongourl of your server in mongourl like so: `mongodb://<url>:<port>`. Also add a name for your collection under `dbName`. Also add your preferred prefix character with `prefix`. Lastly add your preferred update interval time (in hours) by adding an integer to `updateIntervalHours`. Save the config as `config.json`.
### Starting the bot up locally
If you haven't installed the required node_modules, run:
```
npm install
```
To start the bot, run:
```
node index.js
```

## Contact Me
Message me on discord Make#6000 if you have any questions.
