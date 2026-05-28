require('dotenv').config({ quiet: true });

const { createApp } = require('./app');

const port = Number(process.env.PORT || 4000);
const app = createApp();

app.locals.db.migrate().then(() => {
  app.listen(port, () => {
    console.log(`Todo API server listening on port ${port}`);
  });
});
