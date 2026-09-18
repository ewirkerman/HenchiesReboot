const {
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

/**
 * Builds the Firebase Cloud Messaging payload for a turn-change notification.
 *
 * @param {string} gameId - The game room id to open when user clicks the alert.
 * @param {number} turnNumber - The turn number that has started.
 * @return {{ data: { title: string, body: string, url: string } }}
 *   A data-only notification payload that opens the target match with its hash.
 */
function buildNotifyPayload(gameId, turnNumber) {
  return {
    data: {
      title: "It's your turn! ⚔️",
      body: `Turn ${turnNumber} has begun. Make your move!`,
      url: `game.html#${gameId}`,
    },
  };
}

exports.buildNotifyPayload = buildNotifyPayload;

admin.initializeApp();

exports.onTurnChanged = onDocumentUpdated(
    "games/{gameId}",
    async (event) => {
      console.log(`[NOTIF-DEBUG] Trigger fired for gameId: 
        ${event.params.gameId}`);
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();

      // Ensure the data and turn_start_state string exist
      if (!beforeData || !afterData || !afterData.turn_start_state) {
        console.log("[NOTIF-DEBUG] Missing beforeData, afterData,"+
          " or turn_start_state. Exiting.");
        return null;
      }

      let beforeState;
      let afterState;

      try {
      // Safely parse the engine's internal JSON string
        beforeState = JSON.parse(beforeData.turn_start_state || "{}");
        afterState = JSON.parse(afterData.turn_start_state);
      } catch (e) {
        console.error("[NOTIF-DEBUG] Error parsing game state JSON:", e);
        return null;
      }

      console.log(`[NOTIF-DEBUG] Parsed state. Before active: 
        ${beforeState.activePlayerId}, 
        After active: ${afterState.activePlayerId}`);

      // Now we can accurately check if the turn actually changed
      if (beforeState.activePlayerId === afterState.activePlayerId) {
        console.log("[NOTIF-DEBUG] activePlayerId did not change. Exiting.");
        return null;
      }

      const newActivePlayerId = afterState.activePlayerId;
      const playerObj = afterState.players[newActivePlayerId];

      if (!playerObj || playerObj.isAI || playerObj.isDummy) {
        console.log(`[NOTIF-DEBUG] Skipping notification. Player is 
          invalid, AI, or Dummy.`);
        return null;
      }

      const targetUsername = playerObj.name;
      console.log(`[NOTIF-DEBUG] Turn shifted to ${targetUsername}. 
        Looking up profile...`);

      try {
        const db = admin.firestore();
        const profileRef = db.collection("profiles").doc(targetUsername);
        const profileSnap = await profileRef.get();

        if (!profileSnap.exists) {
          console.log(`[NOTIF-DEBUG] No profile found for ${targetUsername}`);
          return null;
        }

        const profileData = profileSnap.data();
        const tokens = profileData.fcmTokens || [];

        if (tokens.length === 0) {
          console.log(`[NOTIF-DEBUG] User ${targetUsername}
             has no registered devices.`);
          return null;
        }
        console.log(`[NOTIF-DEBUG] Found ${tokens.length} token(s) for 
          ${targetUsername}. Preparing payload...`);

        const gameId = event.params.gameId;
        const payload = buildNotifyPayload(gameId, afterState.turnNumber);

        console.log(`[NOTIF-DEBUG] Sending Multicast via admin.messaging()...`);
        const response = await admin.messaging().sendEachForMulticast({
          tokens: tokens,
          data: payload.data,
        });
        console.log(`[NOTIF-DEBUG] Multicast response: ${response.successCount}
           success, ${response.failureCount} failures.`);

        const tokensToRemove = [];
        response.responses.forEach((result, index) => {
          const error = result.error;
          if (error) {
            console.log(`[NOTIF-DEBUG] Token failure: ${error.code} for token
               ${tokens[index].substring(0, 10)}...`);
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
          console.log(`[NOTIF-DEBUG] Cleaning up ${tokensToRemove.length}
             stale tokens.`);
          const arrayRemove = admin.firestore.FieldValue.arrayRemove;
          await profileRef.update({
            fcmTokens: arrayRemove(...tokensToRemove),
          });
        }

        return null;
      } catch (error) {
        console.error("[NOTIF-DEBUG] Error sending turn notification:", error);
        return null;
      }
    },
);
