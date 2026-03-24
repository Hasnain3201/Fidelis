-- =============================================
-- Seed 50 recognizable artists
-- =============================================

INSERT INTO artists (
    id,
    stage_name,
    genre,
    bio,
    media_url,
    created_at,
    updated_at
)
VALUES
(gen_random_uuid(),'Drake','Hip-Hop','Global hip-hop superstar','https://images.livey.com/drake.jpg',now(),now()),
(gen_random_uuid(),'Taylor Swift','Pop','Award-winning pop icon','https://images.livey.com/taylor.jpg',now(),now()),
(gen_random_uuid(),'Bad Bunny','Latin','Leading Latin trap and reggaeton artist','https://images.livey.com/badbunny.jpg',now(),now()),
(gen_random_uuid(),'The Weeknd','R&B','Dark pop and R&B sensation','https://images.livey.com/weeknd.jpg',now(),now()),
(gen_random_uuid(),'Kendrick Lamar','Hip-Hop','Pulitzer Prize-winning rapper','https://images.livey.com/kendrick.jpg',now(),now()),
(gen_random_uuid(),'SZA','R&B','Neo-soul and R&B artist','https://images.livey.com/sza.jpg',now(),now()),
(gen_random_uuid(),'Travis Scott','Hip-Hop','High-energy rap performer','https://images.livey.com/travis.jpg',now(),now()),
(gen_random_uuid(),'Billie Eilish','Pop','Alternative pop superstar','https://images.livey.com/billie.jpg',now(),now()),
(gen_random_uuid(),'Post Malone','Hip-Hop','Genre-blending artist','https://images.livey.com/post.jpg',now(),now()),
(gen_random_uuid(),'Olivia Rodrigo','Pop','Rising pop sensation','https://images.livey.com/olivia.jpg',now(),now()),

(gen_random_uuid(),'Doja Cat','Pop','Versatile pop/rap artist','https://images.livey.com/doja.jpg',now(),now()),
(gen_random_uuid(),'Ariana Grande','Pop','Vocal powerhouse','https://images.livey.com/ariana.jpg',now(),now()),
(gen_random_uuid(),'Lil Uzi Vert','Hip-Hop','Trap and melodic rap artist','https://images.livey.com/uzi.jpg',now(),now()),
(gen_random_uuid(),'Future','Hip-Hop','Trap pioneer','https://images.livey.com/future.jpg',now(),now()),
(gen_random_uuid(),'Metro Boomin','Hip-Hop','Top music producer','https://images.livey.com/metro.jpg',now(),now()),
(gen_random_uuid(),'Ice Spice','Hip-Hop','Rising drill rapper','https://images.livey.com/icespice.jpg',now(),now()),
(gen_random_uuid(),'J. Cole','Hip-Hop','Conscious rapper and producer','https://images.livey.com/jcole.jpg',now(),now()),
(gen_random_uuid(),'Nicki Minaj','Hip-Hop','Legendary female rapper','https://images.livey.com/nicki.jpg',now(),now()),
(gen_random_uuid(),'Megan Thee Stallion','Hip-Hop','Chart-topping rapper','https://images.livey.com/megan.jpg',now(),now()),
(gen_random_uuid(),'Tyler, The Creator','Hip-Hop','Creative hip-hop artist','https://images.livey.com/tyler.jpg',now(),now()),

(gen_random_uuid(),'Lana Del Rey','Alternative','Dream pop artist','https://images.livey.com/lana.jpg',now(),now()),
(gen_random_uuid(),'Frank Ocean','R&B','Influential R&B artist','https://images.livey.com/frank.jpg',now(),now()),
(gen_random_uuid(),'Bruno Mars','Pop','Funk/pop superstar','https://images.livey.com/bruno.jpg',now(),now()),
(gen_random_uuid(),'Harry Styles','Pop','Global pop icon','https://images.livey.com/harry.jpg',now(),now()),
(gen_random_uuid(),'Dua Lipa','Pop','Dance-pop sensation','https://images.livey.com/dualipa.jpg',now(),now()),
(gen_random_uuid(),'Ed Sheeran','Pop','Singer-songwriter','https://images.livey.com/ed.jpg',now(),now()),
(gen_random_uuid(),'Beyoncé','Pop','Global music icon','https://images.livey.com/beyonce.jpg',now(),now()),
(gen_random_uuid(),'Rihanna','Pop','Multi-genre superstar','https://images.livey.com/rihanna.jpg',now(),now()),
(gen_random_uuid(),'Lady Gaga','Pop','Avant-garde pop artist','https://images.livey.com/gaga.jpg',now(),now()),
(gen_random_uuid(),'Kanye West','Hip-Hop','Innovative producer and rapper','https://images.livey.com/kanye.jpg',now(),now()),

(gen_random_uuid(),'Playboi Carti','Hip-Hop','Experimental trap artist','https://images.livey.com/carti.jpg',now(),now()),
(gen_random_uuid(),'Roddy Ricch','Hip-Hop','Melodic rap artist','https://images.livey.com/roddy.jpg',now(),now()),
(gen_random_uuid(),'Lil Baby','Hip-Hop','Atlanta rapper','https://images.livey.com/lilbaby.jpg',now(),now()),
(gen_random_uuid(),'Gunna','Hip-Hop','Trap artist','https://images.livey.com/gunna.jpg',now(),now()),
(gen_random_uuid(),'21 Savage','Hip-Hop','Atlanta-based rapper','https://images.livey.com/21.jpg',now(),now()),
(gen_random_uuid(),'Don Toliver','Hip-Hop','Melodic rap artist','https://images.livey.com/don.jpg',now(),now()),
(gen_random_uuid(),'Central Cee','Hip-Hop','UK rap star','https://images.livey.com/cee.jpg',now(),now()),
(gen_random_uuid(),'Peso Pluma','Latin','Regional Mexican artist','https://images.livey.com/peso.jpg',now(),now()),
(gen_random_uuid(),'Karol G','Latin','Latin pop star','https://images.livey.com/karolg.jpg',now(),now()),
(gen_random_uuid(),'Rauw Alejandro','Latin','Reggaeton artist','https://images.livey.com/rauw.jpg',now(),now()),

(gen_random_uuid(),'Tame Impala','Alternative','Psychedelic music project','https://images.livey.com/tame.jpg',now(),now()),
(gen_random_uuid(),'Arctic Monkeys','Rock','Indie rock band','https://images.livey.com/arctic.jpg',now(),now()),
(gen_random_uuid(),'The 1975','Alternative','Pop rock band','https://images.livey.com/1975.jpg',now(),now()),
(gen_random_uuid(),'Glass Animals','Alternative','Indie pop band','https://images.livey.com/glass.jpg',now(),now()),
(gen_random_uuid(),'ODESZA','Electronic','Electronic duo','https://images.livey.com/odesza.jpg',now(),now()),
(gen_random_uuid(),'Calvin Harris','Electronic','DJ and producer','https://images.livey.com/calvin.jpg',now(),now()),
(gen_random_uuid(),'David Guetta','Electronic','Global DJ','https://images.livey.com/guetta.jpg',now(),now()),
(gen_random_uuid(),'Marshmello','Electronic','Masked DJ','https://images.livey.com/mello.jpg',now(),now()),
(gen_random_uuid(),'Fred again..','Electronic','UK producer','https://images.livey.com/fred.jpg',now(),now()),
(gen_random_uuid(),'Skrillex','Electronic','EDM pioneer','https://images.livey.com/skrillex.jpg',now(),now());