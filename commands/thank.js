const Command = require("../core/command/command.js");

class Thank extends Command {
    async run(client, message, args) {
        await message.channel.send("No problem, I got you.");
    }
}
module.exports = Thank;