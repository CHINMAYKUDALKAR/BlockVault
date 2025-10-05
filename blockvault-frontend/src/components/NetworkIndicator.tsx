import React, { useEffect } from 'react';
import { useChainStore, chainStatus } from '../state/chain';
import { Icon } from './icons';

interface Props {
  expectedChainId?: number;
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  5: 'Goerli',
  11155111: 'Sepolia',
  17000: 'Holesky',
  31337: 'Anvil',
  1337: 'Local'
};

export const NetworkIndicator: React.FC<Props> = ({ expectedChainId }) => {
  const connected = useChainStore(s => s.connectedChainId);
  const setConnected = useChainStore(s => s.setConnected);
  const setExpected = useChainStore(s => s.setExpected);

  useEffect(() => { setExpected(expectedChainId); }, [expectedChainId, setExpected]);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const update = async () => {
      try {
        const cid = await eth.request({ method: 'eth_chainId' });
        if (typeof cid === 'string') setConnected(parseInt(cid, 16));
      } catch {/* ignore */}
    };
    update();
    eth.on?.('chainChanged', update);
    return () => { eth.removeListener?.('chainChanged', update); };
  }, [setConnected]);

  const status = chainStatus(connected, expectedChainId);
  let color = 'text-text-secondary/60 border-border/40 bg-background-tertiary/50';
  let label = 'Network';
  if (status === 'match') { color = 'text-accent-green border-accent-green/40 bg-accent-green/10'; label = 'Network OK'; }
  else if (status === 'mismatch') { color = 'text-accent-red border-accent-red/40 bg-accent-red/10'; label = 'Network Mismatch'; }
  else if (status === 'unset') { label = 'Network Unset'; }
  const connectedName = connected ? (CHAIN_NAMES[connected] || `Chain ${connected}`) : '—';
  const expectedName = expectedChainId ? (CHAIN_NAMES[expectedChainId] || expectedChainId) : 'none';
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border ${color}`} title={`Connected: ${connectedName}\nExpected: ${expectedName}`}> 
      <Icon name="shield" size={12} />
      <span>{label}</span>
    </div>
  );
};
