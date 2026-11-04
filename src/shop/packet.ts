/** The shop's one system moment: an add fires one packet along the header wire into the bag. */
let seq = 0;
const listeners = new Set<() => void>();

export const firePacket = () => {
  seq += 1;
  listeners.forEach((l) => l());
};

export const packetSeq = () => seq;
export const serverPacketSeq = () => 0;

export const subscribePacket = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
