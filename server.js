const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/', express.static('public'));
app.use('/', express.static('proto'));

app.listen(8988, () => {
    console.log(`Server started`);
})