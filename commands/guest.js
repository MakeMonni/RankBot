const Command = require("../core/command/command.js");

class Guest extends Command {
    async run(client, message, args) {
        if (message.member.roles.cache.some(role => role.name === 'landed')) {
            let addRole = message.guild.roles.cache.find(role => role.name === "Guest");
            await message.member.roles.set([addRole])
                .then(DMuser(message))
                .catch(console.log);

            await message.guild.channels.cache.get(client.config.adminchannelID).send(`${message.author} registered as Guest.`);
        }
        else {
            await message.channels.send("You are already have access to the server...");
        }
    }
}
module.exports = Guest;

function DMuser(message) {
    try {
        message.author.send("You have successfully registered to the Finnish Beat Saber community discord. \nRemember to check the rules in the #info-etc channel and for further bot interaction go to #botstuff and enjoy your stay.")

    } catch (err) {
        console.log("Could not dm user" + err)
    }
}