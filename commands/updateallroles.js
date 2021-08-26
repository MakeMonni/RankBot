const Command = require("../core/command/command.js");

class UpdateAllRoles extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
            await message.channel.send(`Updating all registered user roles.`);
            await client.scoresaber.updateAllRoles();
            await message.channel.send(`Finished.`);
        }
    }
}
module.exports = UpdateAllRoles;