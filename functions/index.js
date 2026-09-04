const {
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.onTurnChanged = onDocumentUpdated(
    "games/{gameId}",
    async (event) => {
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();

      // Ensure the data and turn_start_state string exist
      if (!beforeData || !afterData || !afterData.turn_start_state) {
        return null;
      }

      let beforeState;
      let afterState;

      try {
      // Safely parse the engine's internal JSON string
        beforeState = JSON.parse(beforeData.turn_start_state || "{}");
        afterState = JSON.parse(afterData.turn_start_state);
      } catch (e) {
        console.error("Error parsing game state JSON:", e);
        return null;
      }

      // Now we can accurately check if the turn actually changed
      if (beforeState.activePlayerId === afterState.activePlayerId) {
        return null;
      }

      const newActivePlayerId = afterState.activePlayerId;
      const playerObj = afterState.players[newActivePlayerId];

      if (!playerObj || playerObj.isAI || playerObj.isDummy) {
        return null;
      }

      const targetUsername = playerObj.name;

      try {
        const db = admin.firestore();
        const profileRef = db.collection("profiles").doc(targetUsername);
        const profileSnap = await profileRef.get();

        if (!profileSnap.exists) {
          console.log(`No profile found for ${targetUsername}`);
          return null;
        }

        const profileData = profileSnap.data();
        const tokens = profileData.fcmTokens || [];

        if (tokens.length === 0) {
          console.log(`User ${targetUsername} has no registered devices.`);
          return null;
        }

        const payload = {
          data: {
            title: "It's your turn! ⚔️",
            body: `Turn ${afterState.turnNumber} has begun. Make your move!`,
            url: `/game.html#${event.params.gameId}`,
          },
        };

        const response = await admin.messaging().sendEachForMulticast({
          tokens: tokens,
          data: payload.data,
        });

        const tokensToRemove = [];
        response.responses.forEach((result, index) => {
          const error = result.error;
          if (error) {
            const code = error.code;
            if (
              code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
            ) {
              tokensToRemove.push(tokens[index]);
            }
          }
        });

        if (tokensToRemove.length > 0) {
          console.log("Cleaning up stale tokens.");
          const arrayRemove = admin.firestore.FieldValue.arrayRemove;
          await profileRef.update({
            fcmTokens: arrayRemove(...tokensToRemove),
          });
        }

        return null;
      } catch (error) {
        console.error("Error sending turn notification:", error);
        return null;
      }
    },
);
