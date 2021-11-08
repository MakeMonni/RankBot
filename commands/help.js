const Command = require("../core/command/command.js");

class Help extends Command {
    async run(client, message, args) {
        if (message.member.roles.cache.some(role => role.name === 'landed')) {
            try {
                await message.author.send(`Use the **${client.config.prefix}addme <id>** or **${client.config.prefix}guest** commands to get into the server.`)
            }
            catch {
                await message.channel.send(`${message.author} Unable to send a dm to you, make sure you can receive one.`)
            }
        }
        else {
            const commands = Array.from(client.commandHandler.commands.keys());
            const maxCommandLength = Math.max(...(commands.map(x => x.length)));
            let commandString = "```"
            for (let i = 0; i < commands.length; i += 3) {
                commandString += `\n ${commands[i]}` + ` `.repeat(maxCommandLength - commands[i].length)
                if (commands[i + 1]) commandString += ` | ${commands[i + 1]}` + ` `.repeat(maxCommandLength - commands[i + 1].length)
                if (commands[i + 2]) commandString += ` | ${commands[i + 2]}`
            }
            try {
                await message.author.send(`Here are all the available commands usable with ` +
                    `the ${client.config.prefix} prefix\nCommands and what they do can also be found here <https://github.com/MakeMonni/BeatSaberRankBot/wiki/Commands>\nExample \`${client.config.prefix}${commands[0]}\` ${commandString}` + "```");
                await message.channel.send("Sent you a dm, hope it helps.")
            }
            catch {
                await message.channel.send(`${message.author} Unable to send a dm to you, make sure you can receive one.`)
            }
        }
    }
}
module.exports = Help;