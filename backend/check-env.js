import 'dotenv/config';

console.log('JWT_SECRET:', process.env.JWT_SECRET?.slice(0, 10) + '…');
console.log('USER_SERGEY_PIN:', JSON.stringify(process.env.USER_SERGEY_PIN));
console.log('USER_SASHA_PIN:', JSON.stringify(process.env.USER_SASHA_PIN));
console.log('PORT:', process.env.PORT);