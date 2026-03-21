import React, { useState } from 'react';
import Lobby    from './components/Lobby';
import CallRoom from './components/CallRoom';

export default function App() {
  const [session, setSession] = useState(null); // null | { code, role }

  if (!session) {
    return <Lobby onEnterRoom={setSession} />;
  }

  return (
    <CallRoom
      code={session.code}
      role={session.role}
      onLeave={() => setSession(null)}
    />
  );
}
