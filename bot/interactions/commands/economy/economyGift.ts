import { createWallet } from "!/bot/logic/economy/createWallet";
import type { Command } from "!/bot/types";
import { addCurrency } from "!/bot/utils/addCurrency";
import { formatNumber } from "!/bot/utils/formatNumber";
import { safeParseNumber } from "!/bot/utils/parseNumber";
import { prisma } from "!/core/db/prisma";
import { type Interaction, SlashCommandBuilder } from "discord.js";
import { sprintf } from "sprintf-js";
import { z } from "zod";

export const gift = {
  data: new SlashCommandBuilder()
    .setName("gift")
    .setDescription("Gift money to another user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User you wish to gift money to")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("Amount you wish to gift")
        .setRequired(true),
    ),
  async execute(interaction: Interaction) {
    if (!interaction.isRepliable()) {
      return;
    }

    const guildId = interaction.guild?.id;

    if (!guildId) {
      return await interaction.reply(
        "This command can only be used in a server.",
      );
    }

    if (!interaction.isCommand() || !interaction.isChatInputCommand()) {
      return await interaction.reply(
        "This interaction can only be used as a command.",
      );
    }

    const rawAmount = interaction.options.getString("amount");
    const myWallet = await createWallet(interaction.user.id, guildId);

    const amountToGift = z
      .preprocess(
        safeParseNumber,
        z
          .bigint()
          .min(0n)
          .transform((v) => (v === 0n ? myWallet.balance : v)),
      )
      .safeParse(rawAmount);

    if (!amountToGift.success) {
      return await interaction.reply(
        "Invalid amount. Use positive integers only. Example: `/gift @user 50k`",
      );
    }

    if (amountToGift.data < 100n) {
      return await interaction.reply({
        content: "You can't gift less than 100.",
        ephemeral: true,
      });
    }

    const selectedUser = interaction.options.get("user")?.user;

    if (!selectedUser) {
      return await interaction.reply({
        content: "Invalid user",
        ephemeral: true,
      });
    }

    if (selectedUser.bot) {
      return await interaction.reply({
        content: "You can't gift money to a bot",
        ephemeral: true,
      });
    }

    if (selectedUser.id === "566563259268988938") {
      return await interaction.reply({
        content: "You can't gift money to this user.",
        ephemeral: true,
      });
    }

    const theirWallet = await createWallet(selectedUser.id, guildId);

    if (myWallet.balance < amountToGift.data) {
      return await interaction.reply({
        content:
          "You don't have enough money in your wallet to gift this amount",
        ephemeral: true,
      });
    }

    const makeDollars = addCurrency();

    await prisma.$transaction([
      prisma.wallet.update({
        where: {
          id: myWallet.id,
        },
        data: {
          balance: {
            decrement: amountToGift.data,
          },
        },
      }),
      prisma.wallet.update({
        where: {
          id: theirWallet.id,
        },
        data: {
          balance: {
            increment: amountToGift.data,
          },
        },
      }),
    ]);

    return await interaction.reply({
      content: sprintf(
        "<@%s> received **%s** from <@%s>",
        selectedUser.id,
        makeDollars(formatNumber(amountToGift.data)),
        interaction.user.id,
      ),
    });
  },
} satisfies Command;
