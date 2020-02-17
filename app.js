// jshint esversion:6
require('dotenv').config()
const express = require("express")
const bodyParser = require("body-parser")
const ejs = require("ejs")
const mongoose = require("mongoose")
const session = require("express-session")
const passport = require("passport")
const SpotifyWebApi = require('spotify-web-api-node')

const passportLocalMongoose = require("passport-local-mongoose")

const port = process.env.PORT || 3000;

const connectionString = 'mongodb+srv://fabian:' + process.env.MONGO_PW + '@cluster0-26kcr.mongodb.net/tennersDB?retryWrites=true&w=majority'

const app = express()

app.use(express.static("public"))
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({
    extended: true
}))


app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}))


app.use(passport.initialize())
app.use(passport.session())

// Local Mongo

// mongoose.connect("mongodb://localhost:27017/tennersDB", { useNewUrlParser: true, useUnifiedTopology: true })
// mongoose.set('useCreateIndex', true);

// Cloud Mongo

mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    lists: [{
        name: String,
        albums: [{
            id: String,
            artist: String,
            album: String,
            art: String
        }]
    }]
})

userSchema.plugin(passportLocalMongoose)

const User = mongoose.model("User", userSchema)

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


// SPOTIFY API INITIALISATION HERE

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: 'https://tenners.herokuapp.com' || 'https://localhost:3000'
});

// Retrieve an access token
spotifyApi.clientCredentialsGrant().then(
    function (data) {
        console.log('The access token expires in ' + data.body['expires_in']);
        console.log('The access token is ' + data.body['access_token']);

        // Save the access token so that it's used in future calls
        spotifyApi.setAccessToken(data.body['access_token']);
    },
    function (err) {
        console.log('Something went wrong when retrieving an access token', err);
    }
);


//  GET ROUTES


app.get("/", function (req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/home")
    } else {
        res.render("landing")
    }
})

app.get("/login", function (req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/home")
    } else {
        res.render("login")
    }
})

app.get("/register", function (req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/home")
    } else {
        res.render("register")
    }
})

app.get("/home", function (req, res) {
    if (req.isAuthenticated()) {
        res.render('home', { userId: req.user._id, lists: req.user.lists })
        console.log(req.user.lists)
    } else {
        res.redirect("/login")
    }
})

app.get("/:listId/add/", function (req, res) {
    res.render('search', {listId: req.params.listId})
})

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect('/');
})

app.get('/:listId/albums/:artistId', (req, res, next) => {

    spotifyApi
        .getArtistAlbums(req.params.artistId)
        .then(function (data) {
            // res.send(data.body.items)
            res.render('albums', {
                listId: req.params.listId,
                artist: data.body.items[0].artists[0].name,
                albums: data.body.items
            })
        },
            function (err) {
                console.error(err);
            }
        );

});


app.get('/:listId/add/:albumId', (req, res) => {
    
    spotifyApi.getAlbum(req.params.albumId)
        .then(function (data) {
            const currentList = req.user.lists.id(req.params.listId);
            currentList.albums.push({
                id: data.body.id,
                artist: data.body.artists[0].name,
                album: data.body.name,
                art: data.body.images[0].url
            });
            req.user.save();
        });

    res.redirect('/home');

}, function (err) {
    console.error(err);
});

app.get('/remove/:albumId', (req, res) => {
    req.user.faveAlbums.pull(req.params.albumId)
    req.user.save()
    res.redirect('/home')
})



// POST ROUTES

app.post("/newlist", function(req, res) {
    const list = {
        name: req.body.listName
    }
    req.user.lists.push(list)
    req.user.save()
    res.redirect('/home')
})

app.post("/register", function (req, res) {

    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            res.redirect("/register")
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/home")
            })
        }
    })
})

app.post("/login", function (req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, function (err) {
        if (err) {
            console.log(err)
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/home")
            })
        }
    })
})

app.post("/:listId/artist-search", function (req, res) {
    console.log(req.body.userId)
    spotifyApi
        .searchArtists(req.body.artist)
        .then(data => {
            res.render('artist-search-results', {
                listId: req.params.listId,
                searchResults: data.body
            })
        })
        .catch(err => console.log('The error while searching artists occurred: ', err));
})





app.listen(port, () => console.log('Tenners running on ' + port + ' 🎧 🥁 🎸 🔊'));