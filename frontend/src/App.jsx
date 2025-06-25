import React, { useEffect, useState, useRef } from 'react';
import Sender from './Sender';
import Viewer from './Viewer';
import { v4 as uuidv4 } from 'uuid';
import { FaCopy, FaWhatsapp, FaInstagram, FaEye, FaStop } from 'react-icons/fa';
import { motion } from 'framer-motion';
import io from 'socket.io-client';

const socket = io('https://streaming-video-application.onrender.com');

function App() {
  const [role, setRole] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [startBroadcast, setStartBroadcast] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmedPassword, setConfirmedPassword] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    socket.on('viewer-count', (count) => {
      setViewerCount(count);
    });

    return () => {
      socket.off('viewer-count');
    };
  }, []);

  const handleRoleSelection = (selectedRole) => {
    setRole(selectedRole);
    if (selectedRole === 'sender') {
      const id = uuidv4();
      setRoomId(id);
    }
  };

  const handleVideoChange = (e) => {
    const file = URL.createObjectURL(e.target.files[0]);
    setVideoFile(file);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStopBroadcast = () => {
    setStartBroadcast(false);
    socket.emit('stop-broadcast', roomId);
    setVideoFile(null);
    setPassword('');
    setConfirmedPassword(false);
  };

  useEffect(() => {
    if (roomId && confirmedPassword) {
      const url = `${window.location.origin}/?role=viewer&roomId=${roomId}`;
      setShareLink(url);
    }
  }, [roomId, confirmedPassword]);

  const handlePasswordSubmit = () => {
    if (password.trim() !== '') {
      setConfirmedPassword(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300 text-gray-900 p-4">
      {!role && (
        <div className="space-x-4">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleRoleSelection('sender')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg">Sender</motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleRoleSelection('viewer')}
            className="bg-purple-600 text-white px-6 py-3 rounded-xl shadow-lg">Viewer</motion.button>
        </div>
      )}

      {role === 'sender' && (
        <div className="w-full max-w-3xl mt-8 space-y-6 text-center">
          {!videoFile ? (
            <input type="file" accept="video/*" onChange={handleVideoChange}
              className="block mx-auto text-center text-sm" />
          ) : (
            <>
              <motion.video ref={videoRef} src={videoFile} controls className="w-full rounded-lg" autoPlay muted playsInline />
              {!startBroadcast ? (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStartBroadcast(true)}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg">Start Broadcast</motion.button>
              ) : (
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleStopBroadcast}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2">
                  <FaStop /> Stop Broadcast
                </motion.button>
              )}
            </>
          )}

          {!confirmedPassword && (
            <div className="space-y-2 mt-4">
              <input
                type="password"
                placeholder="Set viewer password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-4 py-2 rounded-lg border w-full"
              />
              <motion.button whileTap={{ scale: 0.95 }} onClick={handlePasswordSubmit}
                className="bg-blue-700 text-white px-6 py-2 rounded-lg">Set Password</motion.button>
            </div>
          )}

          {roomId && confirmedPassword && (
            <div className="space-y-2 text-center mt-6">
              <p className="text-gray-700">Viewer Link:</p>
              <p className="text-blue-600 break-all">{shareLink}</p>
              <div className="flex justify-center gap-4 mt-2 flex-wrap">
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleCopy}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <FaCopy /> {copied ? 'Copied!' : 'Copy Link'}
                </motion.button>
                <a href={`https://wa.me/?text=${encodeURIComponent(shareLink)}`} target="_blank" rel="noreferrer"
                  className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaWhatsapp /> WhatsApp</a>
                <a href={`https://instagram.com/?url=${encodeURIComponent(shareLink)}`} target="_blank" rel="noreferrer"
                  className="bg-pink-500 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaInstagram /> Instagram</a>
              </div>
              <div className="mt-4 text-gray-800 flex justify-center items-center gap-2 text-lg">
                <FaEye className="text-blue-600" />
                <span>{viewerCount} viewer{viewerCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          {startBroadcast && videoRef.current && (
            <Sender videoRef={videoRef} roomId={roomId} socket={socket} password={password} />
          )}
        </div>
      )}

      {role === 'viewer' && (
        <Viewer socket={socket} />
      )}
    </div>
  );
}

export default App;
