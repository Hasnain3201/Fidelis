-- =============================================
-- Seed venues across multiple NYC zip codes
-- =============================================

INSERT INTO venues (
    id,
    name,
    description,
    address_line,
    city,
    state,
    zip_code,
    verified,
    created_at,
    updated_at
)
VALUES
(gen_random_uuid(),'Madison Square Garden','Major arena for concerts and events','4 Pennsylvania Plaza','New York','NY','10001',true,now(),now()),
(gen_random_uuid(),'Bowery Ballroom','Historic music venue','6 Delancey St','New York','NY','10002',true,now(),now()),
(gen_random_uuid(),'Webster Hall','Iconic live music venue','125 E 11th St','New York','NY','10003',true,now(),now()),
(gen_random_uuid(),'Le Bain Rooftop','Rooftop nightlife venue with DJs','848 Washington St','New York','NY','10014',true,now(),now()),
(gen_random_uuid(),'Terminal 5','Large concert venue in Midtown','610 W 56th St','New York','NY','10019',true,now(),now()),
(gen_random_uuid(),'Beacon Theatre','Historic theatre for concerts and events','2124 Broadway','New York','NY','10023',true,now(),now()),
(gen_random_uuid(),'Apollo Theater','Legendary Harlem performance venue','253 W 125th St','New York','NY','10027',true,now(),now()),
(gen_random_uuid(),'Brooklyn Steel','Popular Brooklyn music venue','319 Frost St','Brooklyn','NY','11222',true,now(),now()),
(gen_random_uuid(),'House of Yes','Creative nightlife venue and performances','2 Wyckoff Ave','Brooklyn','NY','11237',true,now(),now()),
(gen_random_uuid(),'Music Hall of Williamsburg','Live music venue in Williamsburg','66 N 6th St','Brooklyn','NY','11249',true,now(),now()),
(gen_random_uuid(),'Kings Theatre','Historic Brooklyn theatre','1027 Flatbush Ave','Brooklyn','NY','11226',true,now(),now()),
(gen_random_uuid(),'Knitting Factory','Indie and alternative music venue','361 Metropolitan Ave','Brooklyn','NY','11211',true,now(),now()),
(gen_random_uuid(),'Elsewhere','Multi-room music and arts venue','599 Johnson Ave','Brooklyn','NY','11237',true,now(),now()),
(gen_random_uuid(),'Mercury Lounge','Intimate Lower East Side music venue','217 E Houston St','New York','NY','10002',true,now(),now()),
(gen_random_uuid(),'The Sultan Room','Music venue and rooftop bar','234 Starr St','Brooklyn','NY','11237',true,now(),now());