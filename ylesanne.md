Planeeri ja siis ehita valmis IKT seadmete varahaldussüsteemi MVP (ATK- arvutitöökohateenuse töötaja vaade), mida ettevõtted kasutada saaksid.

ATK töötaja featuurid :

ATK töötajana
tahan vara arvele võtta
et seadme varakaart kajastuks süsteemis
ATK töötajana
tahan teha toiminguid seadmetega
et määrata seadme kasutajaid ja asukohti
ATK töötajana
tahan vaadata varakaarti
et näha seadmega seotud teavet
ATK töötajana
tahan seadmeid maha kanda
et seadmed saaks süsteemist eemaldatud


ATK töötaja User Stories (MVP puhul :

ATK töötaja
Tahan lugeda seadmete arvele võtmise juhendit
et varahaldussüsteemis õigesti seadmed arvele võtta
ATK töötaja
Tahan uusi seadmeid süsteemis arvele võtta
et pärast süsteemis laoseisu vaadates oleks need uued seadmed olemasolevatele lisatud
ATK töötaja
Tahan vanu seadmeid, mis ära visatakse/antakse, süsteemist ära kustutada
et pärast süsteemis  laoseisu vaadates neid vanu  seadmeid enam ei oleks
ATK töötaja
Tahan otsida seadet selle ID põhjal
et mulle kuvataks selle seadme ID, nimetus, olek (laos / kasutaja käes)
ATK töötaja
Tahan otsida seadmeid selle nimetuse põhjal
et mulle kuvataks selle nimetusega seadmete ID, nimetus, olek (laos / kasutaja käes, mis ruumis)
ATK töötaja
Tahan otsida seadmeid selle vara alagrupi põhjal
et mulle kuvataks selle vara alagrupi seadmete ID, nimetus, olek (laos / kasutaja käes, mis ruumis)
ATK töötaja
Tahan otsida seadmeid selle vastutaja nime põhjal
et mulle kuvataks selle töötaja vastutuses olevate seadmete ID, nimetus, olek (laos / kasutaja käes, mis ruumis)
ATK töötaja
Tahan otsida seadmeid, mis on laos
et mulle kuvataks laos olevate seadmete ID, nimetus, olek (laos / kasutaja käes, mis ruumis)
ATK töötaja
Tahan valida kindla ID-ga seadme 
et mulle kuvataks selle ID-ga seadme põhjalikum varakaart, kus on nimetus; olek (laos / kasutaja käes, mis ruumis); vanus; soetamise aeg; järelejäänud kasutusaeg; garantii olek; ostu arve number; seotud toimingud
ATK töötaja
Tahan näha seadme varakaardil toiminguid
et mulle kuvataks kõik toimingud (aktid) millega antud vara on seotud olnud
ATK töötaja
Tahan varakaardi toimingute nimekirjas valida kindla toimingu 
et mulle kuvataks kogu toimingu info (toimingi tüüp; number; kuupäev; koostaja; kellele koostati; seadmed toimingus)
ATK töötaja
Tahan avalehel valida "Toimingud"
et mulle kuvataks ajalises järjekorras esimesed 10 tehtud toimingu kirjet (aeg, toimingu tüüp, number, koostaja)
ATK töötaja
Tahan lahtris "Toimingud" valida "Uus toiming"
et ma saaks alustada uut toimingut 
ATK töötaja
Tahan alustada toimingut
et valida alustatava toimingu tüüp (kasutusse andmine, vara tagastamine)
ATK töötaja
Tahan kasutusse andmise toimingus valida töötaja
et toiming saaks seotud õige isikuga
ATK töötaja
Tahan kasutusse andmise toimingus valida ID-de abil varad
et toiming saaks seotud õigete varadega
ATK töötaja
Tahan kasutusse andmise toimingus kirjutada lisainfo lahtrisse
et saaks kirjutada, mis ruumi antud seade viidi ja mis piletiga seoses toiming tehti
ATK töötaja
Tahan vara tagastamise toimingus valida töötaja
et seejärel kuvataks mulle nimekiri tema nimel olevatest varadest
ATK töötaja
Tahan vara tagastamise toimingus valida antud töötaja nimel olevate varade nimekirjast kindlad varad või kõik varad
et need valitud varad saaks süsteemis määrata tagasi lattu
ATK töötaja
Tahan peale toimingu vormistamist ka toimingu kinnitada
et peale seda muudatused süsteemis salvestuks (varad läheks kas töötaja nimele või tagasi lattu)




Test User Story 6 jaoks:

Test Case 1






















Given


Kasutaja on varahaldussüsteemi sisse loginud


















When


Kasutaja valib avalehel "Varad"


















Then


Avaneb varade vaade


















Test Case 3













Test Case 2


















Given


Varade vaade on lahti














When


Kasutaja valib varade ID otsinguriba














Then


Avaneb varade ID otsinguriba







Test Case 3






























Given


Avatud on varade ID otsinguriba


























When


Kasutaja trükib sisse konkreetse vara olemasoleva ID ja vajutab nuppu "Otsi"


























Then


Avaneb selle ID-ga seadme ID kood, nimetus, olek (laos / kasutaja käes)













Test Case 4






























Given


Avatud on varade ID otsinguriba


























When


Kasutaja trükib sisse kogemata vigase kujuga ID ja vajutab nuppu "Otsi"


























Then


Avaneb veateade, et sellise ID-ga vara süsteemis pole












