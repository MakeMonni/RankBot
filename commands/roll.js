const Command = require("../core/command/command.js");

class Roll extends Command {
    async run(client, message, args) {
        if (!args[0]) {
            await message.channel.send(`${message.author.username} rolled ${Math.floor(Math.random() * 100)} out of 100.`)
        }
        else if (isFinite(args[0]) && args[0] > 0) {
            await message.channel.send(`${message.author.username} rolled ${Math.floor(Math.random() * args[0])} out of ${args[0]}.`)
        }
        else {
            await message.channel.send(`${args[0]} was not a valid roll amount. Try \`${client.config.prefix}roll 100\`.`)
        }
    }
}
module.exports = Roll;