const Command = require("../core/command/command.js");

class Createroles extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
            const roleNames = [
                "Top 50+",
                "Top 50",
                "Top 25",
                "Top 20",
                "Top 15",
                "Top 10",
                "Top 5"
            ];

            for (let roleName of roleNames) {
                if (!message.guild.roles.cache.some(role => role.name == roleName));
                message.guild.roles.create({
                    data: {
                        name: roleName
                    }
                }).catch(err => console.error(`Failed to create role ${roleName}`, err));
            }
        }
    }
}
module.exports = Createroles;