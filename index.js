const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const express = require('express');
const { createCanvas } = require('canvas');
const GIFEncoder = require('canvas-gif-encoder');

const app = express();
app.get('/', (req, res) => res.send('Canvas Roulette is Live!'));
app.listen(3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

let gameActive = false;
let participants = [];
const MAIN_IMG = 'https://cdn.discordapp.com/attachments/1487339993130074115/1497027090179031240/356_20260210215455-1.png';

client.once('ready', () => console.log(`✅ ${client.user.tag} جاهز!`));

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.content !== '!روليت') return;
    if (gameActive) return message.reply('❌ اللعبة شغالة!');

    gameActive = true; participants = [];
    let timer = 100;

    const startEmbed = new EmbedBuilder()
        .setTitle('🎲 روليت الفعاليات')
        .setDescription('**اضغط دخول للمشاركة!**')
        .setColor('#2b2d31').setImage(MAIN_IMG);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('join').setLabel('دخول').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('leave').setLabel('خروج').setStyle(ButtonStyle.Danger)
    );

    const msg = await message.channel.send({ 
        content: `🔔 @everyone\n⏳ ستبدأ خلال: **${timer}** ثانية\n👥 المشاركين: **(0/250)**`, 
        embeds: [startEmbed], 
        components: [row] 
    });

    const countdown = setInterval(async () => {
        timer -= 10;
        if (timer <= 0) {
            clearInterval(countdown);
            return startCanvasRound(message.channel);
        }
        await msg.edit({ content: `🔔 @everyone\n⏳ ستبدأ خلال: **${timer}** ثانية\n👥 المشاركين: **(${participants.length}/250)**` }).catch(() => {});
    }, 10000);
});

client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    if (i.customId === 'join') {
        if (!participants.includes(i.user.id)) { participants.push(i.user.id); return i.reply({ content: '✅ سجلت!', ephemeral: true }); }
    }
    if (i.customId === 'leave') { participants = participants.filter(id => id !== i.user.id); i.reply({ content: 'طلعت!', ephemeral: true }); }
});

async function createSpinningWheel(playerNames) {
    const size = 500;
    const encoder = new GIFEncoder(size, size);
    encoder.setFrameRate(15);
    encoder.setRepeat(0);
    encoder.setQuality(1);
    const stream = encoder.createStream();
    const frames = 15;

    for (let f = 0; f < frames; f++) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size * 0.45;
        const numParticipants = playerNames.length;
        const angleStep = (Math.PI * 2) / numParticipants;
        const currentRotation = (Math.PI * 2 * (f / frames)) * 3;

        for (let i = 0; i < numParticipants; i++) {
            const startAngle = i * angleStep + currentRotation;
            const endAngle = startAngle + angleStep;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.fillStyle = (i % 2 === 0) ? '#e74c3c' : '#2b2d31';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + angleStep / 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(playerNames[i].username.slice(0, 10), radius - 20, 5);
            ctx.restore();
        }
        encoder.addFrame(ctx);
    }
    encoder.finish();
    return stream;
}

async function startCanvasRound(channel) {
    if (participants.length < 2) { gameActive = false; return channel.send('❌ العدد قليل.'); }

    let playerNames = await Promise.all(participants.map(async (id) => {
        const member = await channel.guild.members.fetch(id).catch(() => null);
        return { id: id, username: member ? member.user.username : `User` };
    }));

    const selectedPlayer = playerNames[Math.floor(Math.random() * playerNames.length)];

    if (participants.length === 2) {
        gameActive = false;
        return channel.send({ content: `🏆 الفائز: <@${selectedPlayer.id}>`, embeds: [new EmbedBuilder().setImage(MAIN_IMG).setColor('Gold')] });
    }

    const wheelStream = await createSpinningWheel(playerNames);
    const attachment = new AttachmentBuilder(wheelStream, { name: 'wheel.gif' });
    const wheelEmbed = new EmbedBuilder().setTitle('🎡 العجلة تدور...').setImage('attachment://wheel.gif').setColor('#ffff00');

    let spinMsg = await channel.send({ embeds: [wheelEmbed], files: [attachment] });
    setTimeout(async () => {
        await spinMsg.delete().catch(() => {});
        renderButtons(channel, selectedPlayer.id, 0);
    }, 4000);
}

async function renderButtons(channel, selectedId, page) {
    const others = participants.filter(id => id !== selectedId);
    const start = page * 10;
    const currentPlayers = others.slice(start, start + 10);

    const embed = new EmbedBuilder()
        .setTitle('🎯 الدور عندك!')
        .setDescription(`<@${selectedId}> عندك 15 ثانية للطرد!`)
        .setImage(MAIN_IMG).setColor('#e74c3c');

    const rows = [];
    for (let i = 0; i < currentPlayers.length; i += 2) {
        const row = new ActionRowBuilder();
        for (let j = i; j < i + 2 && j < currentPlayers.length; j++) {
            const pId = currentPlayers[j];
            const m = channel.guild.members.cache.get(pId);
            row.addComponents(new ButtonBuilder().setCustomId(`k_${pId}`).setLabel(`${j + 1 + start} | ${m ? m.user.username : pId}`).setStyle(ButtonStyle.Secondary));
        }
        rows.push(row);
    }

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rand').setLabel('🎲').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(others.length <= start + 10)
    );
    rows.push(navRow);

    const msg = await channel.send({ content: `🔔 دورك <@${selectedId}>`, embeds: [embed], components: rows });
    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === selectedId, time: 15000, max: 1 });

    collector.on('collect', async i => {
        if (i.customId === 'next') { await msg.delete(); return renderButtons(channel, selectedId, page + 1); }
        let victim = i.customId === 'rand' ? others[Math.floor(Math.random() * others.length)] : i.customId.split('_')[1];
        participants = participants.filter(id => id !== victim);
        await i.update({ content: `💥 طردنا <@${victim}>`, embeds: [], components: [] });
        setTimeout(() => startCanvasRound(channel), 2000);
    });
}

client.login('MTQ5NzAyMDEzOTczMDYzMjgyNg.GA0OPV.v8eE9PZ7dd22nLDHfKgEVSlyl3oxm2bMrx7FVU');
