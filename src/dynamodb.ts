import Dynamite from 'dynamite'

export default new Dynamite.Client({
  region: 'us-east-1',
  ...(process.env.IS_OFFLINE
    ? { endpoint: 'http://localhost:8000' }
    : {
        accessKeyId: process.env.IMGSERV_AWS_KEY_ID,
        secretAccessKey: process.env.IMGSERV_AWS_KEY_SECRET,
      }),
})
