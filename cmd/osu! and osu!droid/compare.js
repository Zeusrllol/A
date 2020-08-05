const Discord = require('discord.js');
const config = require('../../config.json');
const osudroid = require('osu-droid');
const cd = new Set();

function rankEmote(input) {
	if (!input) return;
	switch (input) {
		case 'A': return '611559473236148265';
		case 'B': return '611559473169039413';
		case 'C': return '611559473328422942';
		case 'D': return '611559473122639884';
		case 'S': return '611559473294606336';
		case 'X': return '611559473492000769';
		case 'SH': return '611559473361846274';
		case 'XH': return '611559473479155713';
		default : return
	}
}

module.exports.run = (client, message, args, maindb, alicedb, current_map) => {
    if (message.channel instanceof Discord.DMChannel) return message.channel.send("❎ **| I'm sorry, this command is not available in DMs.**")
    if (cd.has(message.author.id)) return message.channel.send("❎ **| Hey, calm down with the command! I need to rest too, you know.**");
    let channel_index = current_map.findIndex(map => map[0] === message.channel.id);
    if (channel_index === -1) return message.channel.send("❎ **| I'm sorry, there is no map being talked in the channel!**");
    let hash = current_map[channel_index][1];

    let ufind = message.author.id;
    if (args[0]) {
        ufind = args[0];
        ufind = ufind.replace("<@!", "").replace("<@", "").replace(">", "")
    }

    let binddb = maindb.collection("userbind");
    let query = {discordid: ufind};
    binddb.findOne(query, async function(err, res) {
        if (err) {
            console.log(err);
            return message.channel.send("❎ **| I'm sorry, I'm having trouble receiving response from database. Please try again!**")
        }
        if (!res) {
            if (args[0]) message.channel.send("❎ **| I'm sorry, that account is not binded. The user needs to bind his/her account using `a!userbind <uid/username>` first. To get uid, use `a!profilesearch <username>`.**");
            else message.channel.send("❎ **| I'm sorry, your account is not binded. You need to bind your account using `a!userbind <uid/username>` first. To get uid, use `a!profilesearch <username>`.**");
            return
        }
        let uid = res.uid;

        const play = await new osudroid.Score().getFromHash({uid: uid, hash: hash});
        if (play.error) return message.channel.send("❎ **| I'm sorry, I couldn't check the map's scores! Perhaps osu!droid server is down?**");
        if (!play.title) return message.channel.send("❎ **| I'm sorry, you don't have scores set in the map!**");
        const name = play.player_name;
        const score = play.score.toLocaleString();
        const combo = play.combo;
        const rank = client.emojis.cache.get(rankEmote(play.rank));
        const mod = play.mods;
        const acc = play.accuracy;
        const miss = play.miss;
        const date = play.date;
        let title = `${play.title} +${play.mods ? play.mods : "No Mod"}`;
        const player = await new osudroid.Player().get({username: name});
        if (player.error) return message.channel.send("❎ **| I'm sorry, I couldn't fetch your profile! Perhaps osu!droid server is down?**");

        let rolecheck;
        try {
            rolecheck = message.member.roles.color.hexColor
        } catch (e) {
            rolecheck = 8311585
        }
        const footer = config.avatar_list;
        const index = Math.floor(Math.random() * footer.length);
        const embed = new Discord.MessageEmbed()
            .setAuthor(title, player.avatarURL)
            .setColor(rolecheck)
            .setFooter(`Achieved on ${date.toUTCString()} | Alice Synthesis Thirty`, footer[index]);

        const mapinfo = await new osudroid.MapInfo().get({hash: hash});
        let n300 = 0
        let n100 = 0;
        let n50 = 0;
        let unstable_rate = 0;
        let min_error = 0;
        let max_error = 0;

        const data = await new osudroid.ReplayAnalyzer({score_id: play.score_id}).analyze();
        if (data.fixed_odr) {
            n300 = data.data.hit300;
            n100 = data.data.hit100;
            n50 = data.data.hit50;

            const hit_object_data = data.data.hit_object_data;
            let hit_error_total = 0;
            let total = 0;
            let _total = 0;
            let count = 0;
            let _count = 0;

            for (const hit_object of hit_object_data) {
                if (hit_object.result === 1) continue;
                const accuracy = hit_object.accuracy;
                hit_error_total += accuracy;
                if (accuracy >= 0) {
                    total += accuracy;
                    ++count;
                } else {
                    _total += accuracy;
                    ++_count;
                }
            }
            
            const mean = hit_error_total / hit_object_data.length;

            let std_deviation = 0;
            for (const hit_object of hit_object_data)
                if (hit_object.result !== 1) std_deviation += Math.pow(hit_object.accuracy - mean, 2);
            unstable_rate = Math.sqrt(std_deviation / hit_object_data.length) * 10;
            max_error = count ? total / count : 0;
            min_error = _count ? _total / _count : 0;
        }

        if (!message.isOwner) {
            cd.add(message.author.id);
            setTimeout(() => {
                cd.delete(message.author.id);
            }, 20000);
        }
        
        if (mapinfo.error || !mapinfo.title || !mapinfo.objects || !mapinfo.osu_file) {
            embed.setDescription(`▸ ${rank} ▸ ${acc}%\n‣ ${score} ▸ ${combo}x ▸ ${n300 ? `[${n300}/${n100}/${n50}/${miss}]\n▸ ${min_error.toFixed(2)}ms - +${max_error.toFixed(2)}ms hit error avg ▸ ${unstable_rate.toFixed(2)} UR` : `${miss} miss(es)`}`);
            return message.channel.send(`✅ **| Comparison play for ${name}:**`, {embed: embed})
        }
        const star = new osudroid.MapStars().calculate({file: mapinfo.osu_file, mods: mod});
        const starsline = parseFloat(star.droid_stars.total.toFixed(2));
        const pcstarsline = parseFloat(star.pc_stars.total.toFixed(2));

        title = `${mapinfo.full_title} +${play.mods ? play.mods : "No Mod"} [${starsline}★ | ${pcstarsline}★]`;
        embed.setAuthor(title, player.avatarURL, `https://osu.ppy.sh/b/${mapinfo.beatmap_id}`)
            .setThumbnail(`https://b.ppy.sh/thumb/${mapinfo.beatmapset_id}l.jpg`)
            .setImage(`https://assets.ppy.sh/beatmaps/${mapinfo.beatmapset_id}/covers/cover.jpg`);

        const npp = osudroid.ppv2({
            stars: star.droid_stars,
            combo: combo,
            acc_percent: acc,
            miss: miss,
            mode: osudroid.modes.droid
        });

        const pcpp = osudroid.ppv2({
            stars: star.pc_stars,
            combo: combo,
            acc_percent: acc,
            miss: miss,
            mode: osudroid.modes.osu
        });

        const ppline = parseFloat(npp.total.toFixed(2));
        const pcppline = parseFloat(pcpp.total.toFixed(2));

        if (miss > 0 || combo < mapinfo.max_combo) {
            const fc_acc = new osudroid.Accuracy({
                n300: (n300 ? n300 : npp.computed_accuracy.n300) + miss,
                n100: n100 ? n100 : npp.computed_accuracy.n100,
                n50 : n50 ? n50 : npp.computed_accuracy.n50,
                nmiss: 0,
                nobjects: mapinfo.objects
            }).value() * 100;

            const fc_dpp = osudroid.ppv2({
                stars: star.droid_stars,
                combo: mapinfo.max_combo,
                acc_percent: fc_acc,
                miss: 0,
                mode: "droid"
            });

            const fc_pp = osudroid.ppv2({
                stars: star.pc_stars,
                combo: mapinfo.max_combo,
                acc_percent: fc_acc,
                miss: 0,
                mode: "osu"
            });

            const dline = parseFloat(fc_dpp.total.toFixed(2));
            const pline = parseFloat(fc_pp.total.toFixed(2));

            embed.setDescription(`▸ ${rank} ▸ **${ppline}DPP** | **${pcppline}PP** (${dline}DPP, ${pline}PP for ${fc_acc.toFixed(2)}% FC) ▸ ${acc}%\n▸ ${score} ▸ ${combo}x/${mapinfo.max_combo}x ▸ ${n300 ? `[${n300}/${n100}/${n50}/${miss}]\n▸ ${min_error.toFixed(2)}ms - +${max_error.toFixed(2)}ms hit error avg ▸ ${unstable_rate.toFixed(2)} UR` : `${miss} miss(es)`}`);
        } else embed.setDescription(`▸ ${rank} ▸ **${ppline}DPP** | **${pcppline}PP** ▸ ${acc}%\n▸ ${score} ▸ ${combo}x/${mapinfo.max_combo}x ▸ ${n300 ? `[${n300}/${n100}/${n50}/${miss}]\n▸ ${min_error.toFixed(2)}ms - +${max_error.toFixed(2)}ms hit error avg ▸ ${unstable_rate.toFixed(2)} UR` : `${miss} miss(es)`}`);

        message.channel.send(`✅ **| Comparison play for ${name}:**`, {embed: embed})
    })
};

module.exports.config = {
    name: "compare",
    aliases: "c",
    description: "Compare your play amongst others.",
    usage: "c [user]",
    detail: "`user`: The user you want to compare [UserResolvable (mention or user ID)]",
    permission: "None"
};