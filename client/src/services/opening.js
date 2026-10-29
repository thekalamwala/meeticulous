/**
 * opening.js — client calls for "The Opening" launch event (/api/opening).
 */
import API from './api';

export const getOpeningStatus = () => API.get('/opening/status').then((r) => r.data);

// send the WhatsApp OTP (Booking OTP campaign) to the number
export const startVerify = (name, phone) =>
  API.post('/opening/verify/start', { name, phone }).then((r) => r.data);

// verify the OTP and place the stone
export const confirmVerify = ({ name, phone, otp, shade, shape }) =>
  API.post('/opening/verify/confirm', { name, phone, otp, shade, shape }).then((r) => r.data);

export const getWall = (cursor, limit = 60) =>
  API.get('/opening/wall', { params: { cursor, limit } }).then((r) => r.data);
