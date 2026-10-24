const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function waitForIce(pc, timeoutMs = 18000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('La red tardó demasiado en preparar el código de conexión. Intenta otra vez.'));
    }, timeoutMs);
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      clearTimeout(timeout);
      pc.removeEventListener('icegatheringstatechange', check);
    };
    pc.addEventListener('icegatheringstatechange', check);
    check();
  });
}

function parseDescription(text, expectedType) {
  let value;
  try { value = JSON.parse(String(text || '').trim()); }
  catch { throw new Error('El código no es JSON válido. Copia todo el texto sin modificarlo.'); }
  if (!value || value.type !== expectedType || typeof value.sdp !== 'string') {
    throw new Error(expectedType === 'offer' ? 'Ese código no parece una invitación de anfitrión.' : 'La respuesta no parece válida.');
  }
  return value;
}

export function createDirectHost({ onMessage, onOpen, onClose }) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const channel = pc.createDataChannel('tekaym-world', { ordered: true });
  wireChannel(channel, onMessage, onOpen, onClose);
  pc.addEventListener('connectionstatechange', () => {
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) onClose?.(pc.connectionState);
  });
  const ready = (async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIce(pc);
    return JSON.stringify(pc.localDescription);
  })();
  return {
    pc,
    ready,
    async acceptAnswer(answerText) {
      await pc.setRemoteDescription(parseDescription(answerText, 'answer'));
    },
    send(message) {
      if (channel.readyState !== 'open') return false;
      channel.send(JSON.stringify(message));
      return true;
    },
    close() { try { channel.close(); } catch {} try { pc.close(); } catch {} }
  };
}

export async function createDirectGuest(offerText, { onMessage, onOpen, onClose }) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.addEventListener('connectionstatechange', () => {
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) onClose?.(pc.connectionState);
  });
  pc.addEventListener('datachannel', event => {
    pc._tekaymChannel = event.channel;
    wireChannel(event.channel, onMessage, onOpen, onClose);
  }, { once: true });
  await pc.setRemoteDescription(parseDescription(offerText, 'offer'));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIce(pc);
  const answerText = JSON.stringify(pc.localDescription);
  return {
    pc,
    answerText,
    send(message) {
      const channel = pc._tekaymChannel;
      if (!channel || channel.readyState !== 'open') return false;
      channel.send(JSON.stringify(message));
      return true;
    },
    close() { try { pc._tekaymChannel?.close(); } catch {} try { pc.close(); } catch {} }
  };
}

function wireChannel(channel, onMessage, onOpen, onClose) {
  channel.addEventListener('open', () => {
    channel.__tekaymOpen = true;
    onOpen?.();
  });
  channel.addEventListener('message', event => {
    try {
      const message = JSON.parse(event.data);
      if (message && typeof message.type === 'string') onMessage?.(message);
    } catch (error) {
      console.warn('[TEKAYM P2P] Mensaje ignorado:', error);
    }
  });
  channel.addEventListener('close', () => onClose?.('closed'));
  channel.addEventListener('error', () => onClose?.('error'));
}
