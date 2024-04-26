import {
  Column,
  ForfeitState,
  GameState,
  SlotState,
  boardSchema,
} from "!/bot/logic/c4/c4types";
import { calculateWinner } from "!/bot/logic/c4/calculateWinner";
import { checkColumn } from "!/bot/logic/c4/checkColumn";
import { makeMove } from "!/bot/logic/c4/makeMove";
import type { AnyInteraction, InteractionContext } from "!/bot/types";
import { prisma } from "!/core/db/prisma";
import { sprintf } from "sprintf-js";
import { z } from "zod";
import { connect4interactionContext } from "./connect4config";
import { connect4display } from "./connect4display";
import { forfeit } from "!/bot/logic/c4/forfeit";

export async function connect4move(
  interactionContext: InteractionContext,
  interaction: AnyInteraction,
): Promise<void> {
  if (!interaction.isStringSelectMenu()) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This interaction is only available as string menu select.",
    }));
  }

  const guildId = interaction.guildId;

  if (!guildId) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This command is only available in servers.",
    }));
  }

  const context = connect4interactionContext.safeParse(
    JSON.parse(interactionContext.payload ?? "{}"),
  );

  if (!context.success) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "Invalid context. Contact developers.",
    }));
  }

  const game = await prisma.connect4Game.findUnique({
    where: {
      id: context.data.gameId,
    },
  });

  if (!game) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "Game not found. Contact developers.",
    }));
  }

  const board = boardSchema.safeParse(JSON.parse(game.board));

  if (!board.success) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "Failed to parse board. Contact developers.",
    }));
  }

  const rawColumn = interaction.values.at(0);

  const column = z.nativeEnum(Column).safeParse(rawColumn);

  if (!column.success) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "Invalid column. Contact developers.",
    }));
  }

  const isChallenger = game.challenger === interaction.user.id;

  const challengerColor = z
    .nativeEnum(SlotState)
    .safeParse(game.challengerColor);

  if (!challengerColor.success) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "Failed to parse challenger color. Contact developers.",
    }));
  }

  const gameEndedPreCheck = [
    GameState.Draw,
    GameState.RedWin,
    GameState.YellowWin,
  ].includes(z.nativeEnum(GameState).parse(game.gameState));

  if (gameEndedPreCheck) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This game has ended.",
    }));
  }

  const challengerColorTurn =
    challengerColor.data === SlotState.Red
      ? GameState.RedTurn
      : GameState.YellowTurn;

  const isUserTurn =
    game.gameState === challengerColorTurn ? isChallenger : !isChallenger;
  if (!isUserTurn) {
    const checkedColumn = checkColumn(board.data, column.data);

    if ("error" in checkedColumn) {
      return void (await interaction.reply({
        ephemeral: true,
        content: checkedColumn.error,
      }));
    }

    return void (await interaction.reply({
      content: sprintf(
        "<@%s> suggests **%s**",
        interaction.user.id,
        column.data,
      ),
    }));
  }

  const moveMade = makeMove(board.data, column.data);

  if ("error" in moveMade) {
    return void (await interaction.reply({
      ephemeral: true,
      content: moveMade.error,
    }));
  }

  const checkWinner = calculateWinner(moveMade);

  const gameEnded = [
    GameState.Draw,
    GameState.RedWin,
    GameState.YellowWin,
  ].includes(
    z.nativeEnum(GameState).parse(checkWinner.gameState ?? moveMade.gameState),
  );

  await prisma.connect4Game.update({
    where: {
      id: game.id,
    },
    data: {
      board: JSON.stringify(checkWinner),
      gameState: checkWinner.gameState,
      lastMoveAt: new Date(),
      endedAt: gameEnded ? new Date() : undefined,
    },
    select: {
      id: true,
    },
  });

  return void (await interaction
    .reply(await connect4display(game.id))
    .then(() => {
      return interaction.message.edit({
        content: "",
        components: [],
      });
    }));
}

export async function connect4forfeit(
  interactionContext: InteractionContext,
  interaction: AnyInteraction,
): Promise<void> {
  if (!interaction.isButton()) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This interaction is only available as button.",
    }));
  }

  const guildId = interaction.guildId;

  if (!guildId) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This command is only available in servers.",
    }));
  }

  const context = connect4interactionContext.safeParse(
    JSON.parse(interactionContext.payload ?? "{}"),
  );

  if (!context.success) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "Invalid context. Contact developers.",
    }));
  }

  const game = await prisma.connect4Game.findUnique({
    where: {
      id: context.data.gameId,
    },
  });

  if (!game) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "Game not found. Contact developers.",
    }));
  }

  if (![game.opponent, game.challenger].includes(interaction.user.id)) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "You are not a player in this game.",
    }));
  }

  const gameEnded = [
    GameState.Draw,
    GameState.RedWin,
    GameState.YellowWin,
  ].includes(z.nativeEnum(GameState).parse(game.gameState));

  if (gameEnded) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This game has ended.",
    }));
  }

  const board = boardSchema.safeParse(JSON.parse(game.board));

  if (!board.success) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "Failed to parse board. Contact developers.",
    }));
  }

  const challengerForfeitState =
    game.challengerColor === SlotState.Red
      ? ForfeitState.Red
      : ForfeitState.Yellow;
  const opponentForfeitState =
    challengerForfeitState === ForfeitState.Red
      ? ForfeitState.Yellow
      : ForfeitState.Red;

  const forfeitedBoard = forfeit(
    board.data,
    game.challenger === interaction.user.id
      ? challengerForfeitState
      : opponentForfeitState,
  );

  await prisma.connect4Game.update({
    where: {
      id: game.id,
    },
    data: {
      board: JSON.stringify(forfeitedBoard),
      gameState:
        game.challenger === interaction.user.id
          ? GameState.YellowWin
          : GameState.RedWin,
      endedAt: new Date(),
    },
  });

  return void (await interaction
    .reply(await connect4display(game.id))
    .then(() => {
      return interaction.message.edit({
        content: "",
        components: [],
      });
    }));
}
