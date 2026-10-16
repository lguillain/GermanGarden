"""Hand-curated seed vocabulary.

Edit this file to grow the dataset. `pipeline.seed` reads it and emits SQL.

Structure per word:
    {
      "id": stable slug used as PK,
      "lemma": base form (noun with article typed separately),
      "article": "der"/"die"/"das" or None,
      "plural": inflected plural or None,
      "pos": "noun"/"verb"/"adj"/"adv"/"conj"/"prep",
      "english": short gloss,
      "level": "A1"/"A2"/"B1",
      "activities": {activity_id: relevance 1-3, ...}  # empty dict = core word
      "sentences": [
          # Either {"activity": aid, "de": "...", "en": "..."} for a tagged sentence
          # or     {"activity": None, "de": "...", "en": "..."} for a generic/core one
      ],
    }

Rules:
  - Each word MUST have at least one sentence per activity it's tagged with.
    Core words get one generic sentence.
  - German sentences use the EXACT lemma (noun with correct case, verb conjugated).
  - Keep sentences short and A1-level readable unless `level` is A2/B1.
"""

from __future__ import annotations

ACTIVITIES = [
    ("doctor",           "At the doctor",           "Appointments, symptoms, prescriptions, test results."),
    ("pharmacy",         "Pharmacy",                "Rezept, side effects, dosage, over-the-counter."),
    ("health_insurance", "Health insurance & admin","Krankenkasse, forms, co-pays, referrals."),
    ("shopping",         "Groceries & shopping",    "Supermarkt, prices, Pfand, bakery, produce."),
    ("clothes",          "Clothes shopping",        "Sizes, fitting rooms, returns, materials."),
    ("work",             "Work & meetings",         "Office, colleagues, deadlines, calls."),
    ("email",            "Email & writing",         "Formal greetings, requests, replies."),
    ("flat_hunt",        "Finding a flat",          "Besichtigung, contracts, deposit, Nebenkosten."),
    ("landlord",         "Landlord & utilities",    "Rent, bills, repairs, neighbors."),
    ("anmeldung",        "Bureaucracy & Anmeldung", "Bürgeramt, forms, residence permit."),
    ("banking",          "Banking & money",         "Konto, Überweisung, cards, fees."),
    ("restaurant",       "Restaurant & cafe",       "Ordering, splitting the bill, reservations."),
    ("cooking",          "Cooking & recipes",       "Ingredients, utensils, steps."),
    ("transport",        "Public transport",        "Tickets, delays, platforms, apps."),
    ("driving",          "Driving & cars",          "Petrol, parking, Werkstatt, directions."),
    ("directions",       "Directions & navigation", "Asking where things are, left/right."),
    ("smalltalk",        "Small talk & weather",    "Greetings, weekend plans, weather."),
    ("family",           "Family & relationships",  "Partner, siblings, parents, visits."),
    ("kids",             "Kids & school",           "Kita, parent-teacher, homework."),
    ("hobbies",          "Hobbies & sports",        "Clubs, gym, outdoors, music."),
    ("travel",           "Travel & holidays",       "Flights, hotels, sightseeing."),
    ("hotel",            "Hotels & accommodation",  "Check-in, breakfast, keys, Wi-Fi."),
    ("tech",             "Phone, internet & tech",  "Contracts, Wi-Fi, apps, bugs."),
    ("dating",           "Dating & going out",      "Bars, clubs, feelings, plans."),
    ("news",             "News & opinions",         "Headlines, politics, current events."),
]


# ---------------------------- A1 (foundation + core) ----------------------------

A1 = [
    # ---- Doctor / Pharmacy / Health insurance ----
    {"id":"a1_n_termin","lemma":"Termin","article":"der","plural":"Termine","pos":"noun","english":"appointment","level":"A1",
     "activities":{"doctor":3,"work":2},
     "sentences":[
       {"activity":"doctor","de":"Ich habe heute einen Termin beim Arzt.","en":"I have an appointment at the doctor today."},
       {"activity":"work","de":"Mein Termin mit dem Chef ist um zehn.","en":"My appointment with the boss is at ten."},
     ]},
    {"id":"a1_n_arzt","lemma":"Arzt","article":"der","plural":"Ärzte","pos":"noun","english":"doctor","level":"A1",
     "activities":{"doctor":3},
     "sentences":[
       {"activity":"doctor","de":"Der Arzt sagt, ich soll viel Wasser trinken.","en":"The doctor says I should drink a lot of water."},
     ]},
    {"id":"a1_n_apotheke","lemma":"Apotheke","article":"die","plural":"Apotheken","pos":"noun","english":"pharmacy","level":"A1",
     "activities":{"pharmacy":3,"doctor":2},
     "sentences":[
       {"activity":"pharmacy","de":"Die Apotheke ist bis 18 Uhr geöffnet.","en":"The pharmacy is open until 6pm."},
       {"activity":"doctor","de":"Mit dem Rezept gehe ich in die Apotheke.","en":"With the prescription I go to the pharmacy."},
     ]},
    {"id":"a1_n_medikament","lemma":"Medikament","article":"das","plural":"Medikamente","pos":"noun","english":"medication","level":"A1",
     "activities":{"pharmacy":3,"doctor":2},
     "sentences":[
       {"activity":"pharmacy","de":"Dieses Medikament gibt es nur mit Rezept.","en":"This medication is only available with a prescription."},
       {"activity":"doctor","de":"Nehmen Sie das Medikament dreimal am Tag.","en":"Take the medication three times a day."},
     ]},
    {"id":"a1_a_krank","lemma":"krank","article":None,"plural":None,"pos":"adj","english":"sick, ill","level":"A1",
     "activities":{"doctor":3,"work":1},
     "sentences":[
       {"activity":"doctor","de":"Ich bin seit Montag krank.","en":"I've been sick since Monday."},
       {"activity":"work","de":"Mein Kollege ist heute krank.","en":"My colleague is sick today."},
     ]},
    {"id":"a1_n_rezept","lemma":"Rezept","article":"das","plural":"Rezepte","pos":"noun","english":"prescription, recipe","level":"A1",
     "activities":{"pharmacy":3,"doctor":2,"cooking":2},
     "sentences":[
       {"activity":"pharmacy","de":"Haben Sie ein Rezept dabei?","en":"Do you have a prescription with you?"},
       {"activity":"doctor","de":"Der Arzt schreibt mir ein Rezept.","en":"The doctor writes me a prescription."},
       {"activity":"cooking","de":"Ich suche ein einfaches Rezept für Suppe.","en":"I'm looking for a simple soup recipe."},
     ]},
    {"id":"a1_n_versicherung","lemma":"Versicherung","article":"die","plural":"Versicherungen","pos":"noun","english":"insurance","level":"A1",
     "activities":{"health_insurance":3,"driving":2,"flat_hunt":1},
     "sentences":[
       {"activity":"health_insurance","de":"Welche Versicherung haben Sie?","en":"Which insurance do you have?"},
       {"activity":"driving","de":"Für das Auto brauche ich eine Versicherung.","en":"I need insurance for the car."},
     ]},
    {"id":"a1_n_karte","lemma":"Karte","article":"die","plural":"Karten","pos":"noun","english":"card","level":"A1",
     "activities":{"health_insurance":3,"banking":3,"shopping":2,"restaurant":2,"transport":2},
     "sentences":[
       {"activity":"health_insurance","de":"Bitte zeigen Sie mir Ihre Karte.","en":"Please show me your card."},
       {"activity":"shopping","de":"Kann ich mit Karte bezahlen?","en":"Can I pay by card?"},
       {"activity":"transport","de":"Meine Karte funktioniert nicht.","en":"My card isn't working."},
     ]},

    # ---- Shopping / Groceries / Clothes ----
    {"id":"a1_n_supermarkt","lemma":"Supermarkt","article":"der","plural":"Supermärkte","pos":"noun","english":"supermarket","level":"A1",
     "activities":{"shopping":3},
     "sentences":[
       {"activity":"shopping","de":"Im Supermarkt gibt es heute frisches Brot.","en":"There's fresh bread at the supermarket today."},
     ]},
    {"id":"a1_n_brot","lemma":"Brot","article":"das","plural":"Brote","pos":"noun","english":"bread","level":"A1",
     "activities":{"shopping":2,"cooking":2,"restaurant":1},
     "sentences":[
       {"activity":"shopping","de":"Ich kaufe jeden Morgen Brot beim Bäcker.","en":"I buy bread at the baker every morning."},
       {"activity":"cooking","de":"Das Brot ist noch warm.","en":"The bread is still warm."},
     ]},
    {"id":"a1_n_wasser","lemma":"Wasser","article":"das","plural":"Wasser","pos":"noun","english":"water","level":"A1",
     "activities":{"shopping":1,"restaurant":2,"doctor":1},
     "sentences":[
       {"activity":"restaurant","de":"Ein Glas Wasser, bitte.","en":"A glass of water, please."},
       {"activity":"doctor","de":"Trinken Sie viel Wasser.","en":"Drink lots of water."},
     ]},
    {"id":"a1_v_kaufen","lemma":"kaufen","article":None,"plural":None,"pos":"verb","english":"to buy","level":"A1",
     "activities":{"shopping":3,"clothes":2,"flat_hunt":1},
     "sentences":[
       {"activity":"shopping","de":"Ich kaufe am Samstag immer ein.","en":"I always go shopping on Saturdays."},
       {"activity":"clothes","de":"Ich möchte eine neue Jacke kaufen.","en":"I'd like to buy a new jacket."},
     ]},
    {"id":"a1_v_bezahlen","lemma":"bezahlen","article":None,"plural":None,"pos":"verb","english":"to pay","level":"A1",
     "activities":{"shopping":3,"restaurant":3,"landlord":2,"pharmacy":1},
     "sentences":[
       {"activity":"restaurant","de":"Ich möchte bitte bezahlen.","en":"I'd like to pay, please."},
       {"activity":"shopping","de":"Wie möchten Sie bezahlen?","en":"How would you like to pay?"},
       {"activity":"landlord","de":"Die Miete bezahle ich am Ersten.","en":"I pay the rent on the first."},
     ]},
    {"id":"a1_n_preis","lemma":"Preis","article":"der","plural":"Preise","pos":"noun","english":"price","level":"A1",
     "activities":{"shopping":3,"flat_hunt":2,"clothes":2,"hotel":2},
     "sentences":[
       {"activity":"shopping","de":"Der Preis ist leider zu hoch.","en":"Unfortunately the price is too high."},
       {"activity":"clothes","de":"Was kostet das? Der Preis steht nicht am Pullover.","en":"How much is this? The price isn't on the sweater."},
     ]},
    {"id":"a1_a_teuer","lemma":"teuer","article":None,"plural":None,"pos":"adj","english":"expensive","level":"A1",
     "activities":{"shopping":2,"flat_hunt":3,"clothes":2,"restaurant":1},
     "sentences":[
       {"activity":"flat_hunt","de":"Die Wohnung ist schön, aber ziemlich teuer.","en":"The flat is nice, but quite expensive."},
       {"activity":"shopping","de":"Dieses Brot ist mir zu teuer.","en":"This bread is too expensive for me."},
     ]},
    {"id":"a1_a_billig","lemma":"billig","article":None,"plural":None,"pos":"adj","english":"cheap","level":"A1",
     "activities":{"shopping":2,"flat_hunt":2,"travel":1},
     "sentences":[
       {"activity":"shopping","de":"Dieses Angebot ist richtig billig.","en":"This deal is really cheap."},
     ]},
    {"id":"a1_n_jacke","lemma":"Jacke","article":"die","plural":"Jacken","pos":"noun","english":"jacket","level":"A1",
     "activities":{"clothes":3,"smalltalk":1},
     "sentences":[
       {"activity":"clothes","de":"Die Jacke ist zu klein.","en":"The jacket is too small."},
       {"activity":"smalltalk","de":"Zieh dir eine Jacke an, es ist kalt.","en":"Put on a jacket, it's cold."},
     ]},
    {"id":"a1_n_schuh","lemma":"Schuh","article":"der","plural":"Schuhe","pos":"noun","english":"shoe","level":"A1",
     "activities":{"clothes":3},
     "sentences":[
       {"activity":"clothes","de":"Welche Größe haben diese Schuhe?","en":"What size are these shoes?"},
     ]},
    {"id":"a1_n_groesse","lemma":"Größe","article":"die","plural":"Größen","pos":"noun","english":"size","level":"A1",
     "activities":{"clothes":3,"shopping":1},
     "sentences":[
       {"activity":"clothes","de":"Haben Sie das in Größe 38?","en":"Do you have this in size 38?"},
     ]},

    # ---- Work / Email ----
    {"id":"a1_v_arbeiten","lemma":"arbeiten","article":None,"plural":None,"pos":"verb","english":"to work","level":"A1",
     "activities":{"work":3},
     "sentences":[
       {"activity":"work","de":"Ich arbeite seit drei Jahren in Berlin.","en":"I've been working in Berlin for three years."},
     ]},
    {"id":"a1_n_buero","lemma":"Büro","article":"das","plural":"Büros","pos":"noun","english":"office","level":"A1",
     "activities":{"work":3},
     "sentences":[
       {"activity":"work","de":"Mein Büro ist im zweiten Stock.","en":"My office is on the second floor."},
     ]},
    {"id":"a1_n_kollege","lemma":"Kollege","article":"der","plural":"Kollegen","pos":"noun","english":"colleague (m.)","level":"A1",
     "activities":{"work":3,"email":2},
     "sentences":[
       {"activity":"work","de":"Mein Kollege kommt heute später.","en":"My colleague is coming in later today."},
     ]},
    {"id":"a1_n_chef","lemma":"Chef","article":"der","plural":"Chefs","pos":"noun","english":"boss","level":"A1",
     "activities":{"work":3,"email":2},
     "sentences":[
       {"activity":"work","de":"Der Chef hat uns zum Mittagessen eingeladen.","en":"The boss invited us to lunch."},
     ]},
    {"id":"a1_n_email","lemma":"E-Mail","article":"die","plural":"E-Mails","pos":"noun","english":"email","level":"A1",
     "activities":{"email":3,"work":2,"tech":1},
     "sentences":[
       {"activity":"email","de":"Ich schreibe gerade eine E-Mail an den Kunden.","en":"I'm just writing an email to the client."},
       {"activity":"work","de":"Hast du meine E-Mail bekommen?","en":"Did you get my email?"},
     ]},
    {"id":"a1_v_schreiben","lemma":"schreiben","article":None,"plural":None,"pos":"verb","english":"to write","level":"A1",
     "activities":{"email":3,"work":1,"kids":1},
     "sentences":[
       {"activity":"email","de":"Könnten Sie mir das bitte schreiben?","en":"Could you write that to me, please?"},
     ]},
    {"id":"a1_n_sitzung","lemma":"Sitzung","article":"die","plural":"Sitzungen","pos":"noun","english":"meeting","level":"A1",
     "activities":{"work":3},
     "sentences":[
       {"activity":"work","de":"Die Sitzung dauert bis vier Uhr.","en":"The meeting lasts until four."},
     ]},

    # ---- Flat hunt / Landlord / Anmeldung ----
    {"id":"a1_n_wohnung","lemma":"Wohnung","article":"die","plural":"Wohnungen","pos":"noun","english":"flat, apartment","level":"A1",
     "activities":{"flat_hunt":3,"landlord":2},
     "sentences":[
       {"activity":"flat_hunt","de":"Die Wohnung hat zwei Zimmer und ist hell.","en":"The flat has two rooms and is bright."},
     ]},
    {"id":"a1_n_zimmer","lemma":"Zimmer","article":"das","plural":"Zimmer","pos":"noun","english":"room","level":"A1",
     "activities":{"flat_hunt":3,"hotel":3},
     "sentences":[
       {"activity":"flat_hunt","de":"Wie viele Zimmer hat die Wohnung?","en":"How many rooms does the flat have?"},
       {"activity":"hotel","de":"Ich habe ein Zimmer für zwei Nächte reserviert.","en":"I reserved a room for two nights."},
     ]},
    {"id":"a1_v_wohnen","lemma":"wohnen","article":None,"plural":None,"pos":"verb","english":"to live, reside","level":"A1",
     "activities":{"flat_hunt":3,"smalltalk":2},
     "sentences":[
       {"activity":"flat_hunt","de":"Wir wohnen seit zwei Jahren in dieser Stadt.","en":"We've lived in this city for two years."},
     ]},
    {"id":"a1_n_miete","lemma":"Miete","article":"die","plural":"Mieten","pos":"noun","english":"rent","level":"A1",
     "activities":{"flat_hunt":3,"landlord":3},
     "sentences":[
       {"activity":"flat_hunt","de":"Wie hoch ist die Miete?","en":"How much is the rent?"},
       {"activity":"landlord","de":"Die Miete ist am Ersten fällig.","en":"The rent is due on the first."},
     ]},
    {"id":"a1_n_vermieter","lemma":"Vermieter","article":"der","plural":"Vermieter","pos":"noun","english":"landlord","level":"A1",
     "activities":{"landlord":3,"flat_hunt":2},
     "sentences":[
       {"activity":"landlord","de":"Der Vermieter kommt morgen vorbei.","en":"The landlord is coming by tomorrow."},
     ]},
    {"id":"a1_n_rechnung","lemma":"Rechnung","article":"die","plural":"Rechnungen","pos":"noun","english":"bill, invoice","level":"A1",
     "activities":{"shopping":2,"restaurant":3,"landlord":2,"health_insurance":1},
     "sentences":[
       {"activity":"restaurant","de":"Die Rechnung, bitte!","en":"The bill, please!"},
       {"activity":"landlord","de":"Ich bezahle die Rechnung für den Strom.","en":"I pay the electricity bill."},
     ]},
    {"id":"a1_n_vertrag","lemma":"Vertrag","article":"der","plural":"Verträge","pos":"noun","english":"contract","level":"A1",
     "activities":{"flat_hunt":3,"work":2,"tech":2},
     "sentences":[
       {"activity":"flat_hunt","de":"Lesen Sie den Vertrag bitte genau durch.","en":"Please read the contract carefully."},
       {"activity":"tech","de":"Mein Vertrag läuft im Juni aus.","en":"My contract runs out in June."},
     ]},
    {"id":"a1_n_formular","lemma":"Formular","article":"das","plural":"Formulare","pos":"noun","english":"form","level":"A1",
     "activities":{"anmeldung":3,"health_insurance":2,"banking":1},
     "sentences":[
       {"activity":"anmeldung","de":"Füllen Sie bitte dieses Formular aus.","en":"Please fill out this form."},
     ]},
    {"id":"a1_n_pass","lemma":"Pass","article":"der","plural":"Pässe","pos":"noun","english":"passport","level":"A1",
     "activities":{"anmeldung":3,"travel":3,"hotel":2},
     "sentences":[
       {"activity":"anmeldung","de":"Bitte zeigen Sie mir Ihren Pass.","en":"Please show me your passport."},
       {"activity":"travel","de":"Mein Pass ist noch sechs Monate gültig.","en":"My passport is valid for six more months."},
     ]},

    # ---- Banking / Restaurant / Cooking ----
    {"id":"a1_n_bank","lemma":"Bank","article":"die","plural":"Banken","pos":"noun","english":"bank","level":"A1",
     "activities":{"banking":3,"directions":1},
     "sentences":[
       {"activity":"banking","de":"Die Bank schließt um 16 Uhr.","en":"The bank closes at 4pm."},
     ]},
    {"id":"a1_n_geld","lemma":"Geld","article":"das","plural":"Gelder","pos":"noun","english":"money","level":"A1",
     "activities":{"banking":3,"shopping":2,"work":1},
     "sentences":[
       {"activity":"banking","de":"Ich muss Geld abheben.","en":"I need to withdraw money."},
     ]},
    {"id":"a1_n_konto","lemma":"Konto","article":"das","plural":"Konten","pos":"noun","english":"account","level":"A1",
     "activities":{"banking":3},
     "sentences":[
       {"activity":"banking","de":"Ich möchte ein Konto eröffnen.","en":"I'd like to open an account."},
     ]},
    {"id":"a1_n_restaurant","lemma":"Restaurant","article":"das","plural":"Restaurants","pos":"noun","english":"restaurant","level":"A1",
     "activities":{"restaurant":3,"dating":2},
     "sentences":[
       {"activity":"restaurant","de":"Das Restaurant ist heute geschlossen.","en":"The restaurant is closed today."},
       {"activity":"dating","de":"Kennst du ein gutes Restaurant hier?","en":"Do you know a good restaurant around here?"},
     ]},
    {"id":"a1_v_bestellen","lemma":"bestellen","article":None,"plural":None,"pos":"verb","english":"to order","level":"A1",
     "activities":{"restaurant":3,"shopping":2},
     "sentences":[
       {"activity":"restaurant","de":"Ich möchte eine Pizza bestellen.","en":"I'd like to order a pizza."},
       {"activity":"shopping","de":"Das kann man online bestellen.","en":"You can order that online."},
     ]},
    {"id":"a1_v_kochen","lemma":"kochen","article":None,"plural":None,"pos":"verb","english":"to cook","level":"A1",
     "activities":{"cooking":3,"family":1},
     "sentences":[
       {"activity":"cooking","de":"Heute Abend koche ich Nudeln.","en":"I'm cooking pasta tonight."},
     ]},
    {"id":"a1_v_essen","lemma":"essen","article":None,"plural":None,"pos":"verb","english":"to eat","level":"A1",
     "activities":{"restaurant":3,"cooking":2,"smalltalk":1},
     "sentences":[
       {"activity":"restaurant","de":"Was möchten Sie essen?","en":"What would you like to eat?"},
       {"activity":"cooking","de":"Zum Mittag essen wir Suppe.","en":"We're eating soup for lunch."},
     ]},
    {"id":"a1_v_trinken","lemma":"trinken","article":None,"plural":None,"pos":"verb","english":"to drink","level":"A1",
     "activities":{"restaurant":3,"doctor":1,"dating":1},
     "sentences":[
       {"activity":"restaurant","de":"Was möchten Sie trinken?","en":"What would you like to drink?"},
     ]},

    # ---- Transport / Driving / Directions ----
    {"id":"a1_n_zug","lemma":"Zug","article":"der","plural":"Züge","pos":"noun","english":"train","level":"A1",
     "activities":{"transport":3,"travel":2},
     "sentences":[
       {"activity":"transport","de":"Der Zug fährt in fünf Minuten.","en":"The train leaves in five minutes."},
       {"activity":"travel","de":"Mit dem Zug nach München dauert es sechs Stunden.","en":"The train to Munich takes six hours."},
     ]},
    {"id":"a1_n_bahnhof","lemma":"Bahnhof","article":"der","plural":"Bahnhöfe","pos":"noun","english":"train station","level":"A1",
     "activities":{"transport":3,"directions":2},
     "sentences":[
       {"activity":"transport","de":"Wir treffen uns am Bahnhof.","en":"We'll meet at the station."},
       {"activity":"directions","de":"Wie komme ich zum Bahnhof?","en":"How do I get to the station?"},
     ]},
    {"id":"a1_n_ticket","lemma":"Ticket","article":"das","plural":"Tickets","pos":"noun","english":"ticket","level":"A1",
     "activities":{"transport":3,"travel":2,"hobbies":1},
     "sentences":[
       {"activity":"transport","de":"Mein Ticket gilt bis morgen.","en":"My ticket is valid until tomorrow."},
     ]},
    {"id":"a1_n_auto","lemma":"Auto","article":"das","plural":"Autos","pos":"noun","english":"car","level":"A1",
     "activities":{"driving":3,"transport":1},
     "sentences":[
       {"activity":"driving","de":"Mein Auto steht in der Garage.","en":"My car is in the garage."},
     ]},
    {"id":"a1_v_fahren","lemma":"fahren","article":None,"plural":None,"pos":"verb","english":"to drive, go (by vehicle)","level":"A1",
     "activities":{"driving":3,"transport":3,"travel":2},
     "sentences":[
       {"activity":"driving","de":"Ich fahre jeden Tag zur Arbeit.","en":"I drive to work every day."},
       {"activity":"transport","de":"Wir fahren mit der U-Bahn.","en":"We're taking the metro."},
     ]},
    {"id":"a1_v_gehen","lemma":"gehen","article":None,"plural":None,"pos":"verb","english":"to go, walk","level":"A1",
     "activities":{"directions":2,"hobbies":1,"smalltalk":1},
     "sentences":[
       {"activity":"directions","de":"Gehen Sie geradeaus bis zur Ampel.","en":"Go straight ahead to the traffic light."},
     ]},
    {"id":"a1_a_links","lemma":"links","article":None,"plural":None,"pos":"adv","english":"left","level":"A1",
     "activities":{"directions":3,"driving":2},
     "sentences":[
       {"activity":"directions","de":"An der Kreuzung links abbiegen.","en":"Turn left at the intersection."},
     ]},
    {"id":"a1_a_rechts","lemma":"rechts","article":None,"plural":None,"pos":"adv","english":"right","level":"A1",
     "activities":{"directions":3,"driving":2},
     "sentences":[
       {"activity":"directions","de":"Die Apotheke ist rechts von der Bank.","en":"The pharmacy is to the right of the bank."},
     ]},

    # ---- Family / Kids / Dating ----
    {"id":"a1_n_familie","lemma":"Familie","article":"die","plural":"Familien","pos":"noun","english":"family","level":"A1",
     "activities":{"family":3,"smalltalk":2},
     "sentences":[
       {"activity":"family","de":"Meine Familie wohnt in Italien.","en":"My family lives in Italy."},
     ]},
    {"id":"a1_n_kind","lemma":"Kind","article":"das","plural":"Kinder","pos":"noun","english":"child","level":"A1",
     "activities":{"family":3,"kids":3,"smalltalk":1},
     "sentences":[
       {"activity":"kids","de":"Mein Kind geht in die zweite Klasse.","en":"My child is in second grade."},
     ]},
    {"id":"a1_n_schule","lemma":"Schule","article":"die","plural":"Schulen","pos":"noun","english":"school","level":"A1",
     "activities":{"kids":3},
     "sentences":[
       {"activity":"kids","de":"Die Schule beginnt um acht Uhr.","en":"School starts at eight."},
     ]},
    {"id":"a1_n_freund","lemma":"Freund","article":"der","plural":"Freunde","pos":"noun","english":"friend (m.) / boyfriend","level":"A1",
     "activities":{"family":2,"dating":3,"smalltalk":2},
     "sentences":[
       {"activity":"dating","de":"Mein Freund kommt aus Spanien.","en":"My boyfriend is from Spain."},
       {"activity":"family","de":"Ich besuche einen alten Freund.","en":"I'm visiting an old friend."},
     ]},

    # ---- Hobbies / Travel / Hotel / Tech / News ----
    {"id":"a1_n_hobby","lemma":"Hobby","article":"das","plural":"Hobbys","pos":"noun","english":"hobby","level":"A1",
     "activities":{"hobbies":3,"smalltalk":2},
     "sentences":[
       {"activity":"hobbies","de":"Mein Hobby ist Fotografieren.","en":"My hobby is photography."},
     ]},
    {"id":"a1_n_urlaub","lemma":"Urlaub","article":"der","plural":"Urlaube","pos":"noun","english":"holiday, vacation","level":"A1",
     "activities":{"travel":3,"smalltalk":2,"work":2},
     "sentences":[
       {"activity":"travel","de":"Wir fahren nächste Woche in den Urlaub.","en":"We're going on holiday next week."},
       {"activity":"work","de":"Mein Chef ist bis Montag im Urlaub.","en":"My boss is on holiday until Monday."},
     ]},
    {"id":"a1_n_hotel","lemma":"Hotel","article":"das","plural":"Hotels","pos":"noun","english":"hotel","level":"A1",
     "activities":{"hotel":3,"travel":2},
     "sentences":[
       {"activity":"hotel","de":"Das Hotel liegt direkt am Strand.","en":"The hotel is right by the beach."},
     ]},
    {"id":"a1_n_internet","lemma":"Internet","article":"das","plural":None,"pos":"noun","english":"internet","level":"A1",
     "activities":{"tech":3,"hotel":2},
     "sentences":[
       {"activity":"tech","de":"Das Internet funktioniert nicht.","en":"The internet isn't working."},
       {"activity":"hotel","de":"Gibt es im Zimmer kostenloses Internet?","en":"Is there free internet in the room?"},
     ]},
    {"id":"a1_n_telefon","lemma":"Telefon","article":"das","plural":"Telefone","pos":"noun","english":"phone","level":"A1",
     "activities":{"tech":3,"work":2},
     "sentences":[
       {"activity":"tech","de":"Mein Telefon ist kaputt.","en":"My phone is broken."},
     ]},
    {"id":"a1_n_wetter","lemma":"Wetter","article":"das","plural":None,"pos":"noun","english":"weather","level":"A1",
     "activities":{"smalltalk":3,"travel":1},
     "sentences":[
       {"activity":"smalltalk","de":"Heute ist das Wetter wirklich schön.","en":"The weather is really nice today."},
     ]},

    # ---- Core (no activity) ----
    {"id":"a1_c_weil","lemma":"weil","article":None,"plural":None,"pos":"conj","english":"because","level":"A1",
     "activities":{},
     "sentences":[{"activity":None,"de":"Ich bleibe zu Hause, weil ich müde bin.","en":"I'm staying home because I'm tired."}]},
    {"id":"a1_c_schon","lemma":"schon","article":None,"plural":None,"pos":"adv","english":"already","level":"A1",
     "activities":{},
     "sentences":[{"activity":None,"de":"Ich habe schon gegessen, danke.","en":"I've already eaten, thanks."}]},
    {"id":"a1_c_heute","lemma":"heute","article":None,"plural":None,"pos":"adv","english":"today","level":"A1",
     "activities":{},
     "sentences":[{"activity":None,"de":"Heute scheint die Sonne.","en":"The sun is shining today."}]},
    {"id":"a1_c_morgen","lemma":"morgen","article":None,"plural":None,"pos":"adv","english":"tomorrow","level":"A1",
     "activities":{},
     "sentences":[{"activity":None,"de":"Morgen fahre ich nach München.","en":"Tomorrow I'm going to Munich."}]},
    {"id":"a1_c_gut","lemma":"gut","article":None,"plural":None,"pos":"adj","english":"good","level":"A1",
     "activities":{},
     "sentences":[{"activity":None,"de":"Mir geht es heute wirklich gut.","en":"I'm really doing well today."}]},
    {"id":"a1_c_sehr","lemma":"sehr","article":None,"plural":None,"pos":"adv","english":"very","level":"A1",
     "activities":{},
     "sentences":[{"activity":None,"de":"Das ist sehr nett von dir.","en":"That's very kind of you."}]},
    {"id":"a1_c_auch","lemma":"auch","article":None,"plural":None,"pos":"adv","english":"also, too","level":"A1",
     "activities":{},
     "sentences":[{"activity":None,"de":"Ich komme auch mit.","en":"I'm coming too."}]},
    {"id":"a1_c_nicht","lemma":"nicht","article":None,"plural":None,"pos":"adv","english":"not","level":"A1",
     "activities":{},
     "sentences":[{"activity":None,"de":"Das verstehe ich leider nicht.","en":"I don't understand that, I'm afraid."}]},
    {"id":"a1_c_aber","lemma":"aber","article":None,"plural":None,"pos":"conj","english":"but","level":"A1",
     "activities":{},
     "sentences":[{"activity":None,"de":"Das ist klein, aber praktisch.","en":"It's small but practical."}]},
    {"id":"a1_c_dass","lemma":"dass","article":None,"plural":None,"pos":"conj","english":"that (conj.)","level":"A1",
     "activities":{},
     "sentences":[{"activity":None,"de":"Ich glaube, dass es morgen regnet.","en":"I think it'll rain tomorrow."}]},
]


# ---------------------------- A2 ----------------------------

A2 = [
    {"id":"a2_n_versicherungskarte","lemma":"Versicherungskarte","article":"die","plural":"Versicherungskarten","pos":"noun","english":"insurance card","level":"A2",
     "activities":{"health_insurance":3,"doctor":2,"pharmacy":2},
     "sentences":[
       {"activity":"doctor","de":"Haben Sie Ihre Versicherungskarte dabei?","en":"Do you have your insurance card with you?"},
     ]},
    {"id":"a2_n_ueberweisung","lemma":"Überweisung","article":"die","plural":"Überweisungen","pos":"noun","english":"referral / bank transfer","level":"A2",
     "activities":{"doctor":3,"banking":3,"health_insurance":2},
     "sentences":[
       {"activity":"doctor","de":"Ich brauche eine Überweisung zum Facharzt.","en":"I need a referral to a specialist."},
       {"activity":"banking","de":"Die Überweisung dauert zwei Werktage.","en":"The transfer takes two business days."},
     ]},
    {"id":"a2_n_befund","lemma":"Befund","article":"der","plural":"Befunde","pos":"noun","english":"test result, findings","level":"A2",
     "activities":{"doctor":3},
     "sentences":[
       {"activity":"doctor","de":"Der Befund ist zum Glück unauffällig.","en":"Fortunately the result is unremarkable."},
     ]},
    {"id":"a2_v_bewerben","lemma":"sich bewerben","article":None,"plural":None,"pos":"verb","english":"to apply","level":"A2",
     "activities":{"work":3,"email":2,"flat_hunt":1},
     "sentences":[
       {"activity":"work","de":"Ich möchte mich auf diese Stelle bewerben.","en":"I'd like to apply for this position."},
     ]},
    {"id":"a2_n_bewerbung","lemma":"Bewerbung","article":"die","plural":"Bewerbungen","pos":"noun","english":"application","level":"A2",
     "activities":{"work":3,"email":2},
     "sentences":[
       {"activity":"work","de":"Meine Bewerbung ist noch nicht fertig.","en":"My application isn't ready yet."},
     ]},
    {"id":"a2_n_lebenslauf","lemma":"Lebenslauf","article":"der","plural":"Lebensläufe","pos":"noun","english":"CV, résumé","level":"A2",
     "activities":{"work":3,"email":1},
     "sentences":[
       {"activity":"work","de":"Bitte senden Sie uns Ihren Lebenslauf.","en":"Please send us your CV."},
     ]},
    {"id":"a2_n_frist","lemma":"Frist","article":"die","plural":"Fristen","pos":"noun","english":"deadline","level":"A2",
     "activities":{"work":3,"anmeldung":2},
     "sentences":[
       {"activity":"work","de":"Die Frist für das Projekt ist Freitag.","en":"The deadline for the project is Friday."},
     ]},
    {"id":"a2_n_besichtigung","lemma":"Besichtigung","article":"die","plural":"Besichtigungen","pos":"noun","english":"viewing","level":"A2",
     "activities":{"flat_hunt":3},
     "sentences":[
       {"activity":"flat_hunt","de":"Die Besichtigung ist am Samstag um elf.","en":"The viewing is on Saturday at eleven."},
     ]},
    {"id":"a2_n_kaution","lemma":"Kaution","article":"die","plural":"Kautionen","pos":"noun","english":"deposit","level":"A2",
     "activities":{"flat_hunt":3,"landlord":2},
     "sentences":[
       {"activity":"flat_hunt","de":"Die Kaution beträgt drei Monatsmieten.","en":"The deposit is three months' rent."},
     ]},
    {"id":"a2_n_nebenkosten","lemma":"Nebenkosten","article":"die","plural":"Nebenkosten","pos":"noun","english":"utilities (plural only)","level":"A2",
     "activities":{"flat_hunt":3,"landlord":3},
     "sentences":[
       {"activity":"flat_hunt","de":"Sind die Nebenkosten in der Miete enthalten?","en":"Are utilities included in the rent?"},
     ]},
    {"id":"a2_n_anmeldung","lemma":"Anmeldung","article":"die","plural":"Anmeldungen","pos":"noun","english":"registration","level":"A2",
     "activities":{"anmeldung":3},
     "sentences":[
       {"activity":"anmeldung","de":"Für die Anmeldung brauchen Sie einen Termin.","en":"You need an appointment for the registration."},
     ]},
    {"id":"a2_n_buergeramt","lemma":"Bürgeramt","article":"das","plural":"Bürgerämter","pos":"noun","english":"citizens' office","level":"A2",
     "activities":{"anmeldung":3},
     "sentences":[
       {"activity":"anmeldung","de":"Das Bürgeramt hat heute lange Wartezeiten.","en":"The citizens' office has long wait times today."},
     ]},
    {"id":"a2_n_aufenthaltstitel","lemma":"Aufenthaltstitel","article":"der","plural":"Aufenthaltstitel","pos":"noun","english":"residence permit","level":"A2",
     "activities":{"anmeldung":3},
     "sentences":[
       {"activity":"anmeldung","de":"Mein Aufenthaltstitel läuft im Juni ab.","en":"My residence permit expires in June."},
     ]},
    {"id":"a2_n_rueckgabe","lemma":"Rückgabe","article":"die","plural":"Rückgaben","pos":"noun","english":"return (of goods)","level":"A2",
     "activities":{"clothes":3,"shopping":2},
     "sentences":[
       {"activity":"clothes","de":"Die Rückgabe ist nur mit Kassenbon möglich.","en":"Returns are only possible with a receipt."},
     ]},
    {"id":"a2_n_umkleide","lemma":"Umkleidekabine","article":"die","plural":"Umkleidekabinen","pos":"noun","english":"fitting room","level":"A2",
     "activities":{"clothes":3},
     "sentences":[
       {"activity":"clothes","de":"Die Umkleidekabine ist hinten rechts.","en":"The fitting room is at the back right."},
     ]},
    {"id":"a2_v_umsteigen","lemma":"umsteigen","article":None,"plural":None,"pos":"verb","english":"to change (trains)","level":"A2",
     "activities":{"transport":3,"travel":1},
     "sentences":[
       {"activity":"transport","de":"Sie müssen in Köln umsteigen.","en":"You have to change in Cologne."},
     ]},
    {"id":"a2_n_verspaetung","lemma":"Verspätung","article":"die","plural":"Verspätungen","pos":"noun","english":"delay","level":"A2",
     "activities":{"transport":3,"travel":2,"work":1},
     "sentences":[
       {"activity":"transport","de":"Der Zug hat zwanzig Minuten Verspätung.","en":"The train is twenty minutes late."},
     ]},
    {"id":"a2_n_fahrkarte","lemma":"Fahrkarte","article":"die","plural":"Fahrkarten","pos":"noun","english":"ticket (travel)","level":"A2",
     "activities":{"transport":3},
     "sentences":[
       {"activity":"transport","de":"Wo kann ich eine Fahrkarte kaufen?","en":"Where can I buy a ticket?"},
     ]},
    {"id":"a2_n_tankstelle","lemma":"Tankstelle","article":"die","plural":"Tankstellen","pos":"noun","english":"petrol station","level":"A2",
     "activities":{"driving":3,"directions":1},
     "sentences":[
       {"activity":"driving","de":"Die nächste Tankstelle ist zehn Kilometer entfernt.","en":"The next petrol station is ten kilometres away."},
     ]},
    {"id":"a2_v_tanken","lemma":"tanken","article":None,"plural":None,"pos":"verb","english":"to refuel","level":"A2",
     "activities":{"driving":3},
     "sentences":[
       {"activity":"driving","de":"Ich muss noch tanken.","en":"I still need to refuel."},
     ]},
    {"id":"a2_n_werkstatt","lemma":"Werkstatt","article":"die","plural":"Werkstätten","pos":"noun","english":"garage, workshop","level":"A2",
     "activities":{"driving":3},
     "sentences":[
       {"activity":"driving","de":"Das Auto ist in der Werkstatt.","en":"The car is at the garage."},
     ]},
    {"id":"a2_n_rezept2","lemma":"Rezept","article":"das","plural":"Rezepte","pos":"noun","english":"recipe (dish)","level":"A2",
     "activities":{"cooking":3},
     "sentences":[
       {"activity":"cooking","de":"Mama hat mir das Rezept gegeben.","en":"Mum gave me the recipe."},
     ]},
    {"id":"a2_n_zutat","lemma":"Zutat","article":"die","plural":"Zutaten","pos":"noun","english":"ingredient","level":"A2",
     "activities":{"cooking":3,"shopping":1},
     "sentences":[
       {"activity":"cooking","de":"Welche Zutaten brauchst du noch?","en":"Which ingredients do you still need?"},
     ]},
    {"id":"a2_v_schneiden","lemma":"schneiden","article":None,"plural":None,"pos":"verb","english":"to cut","level":"A2",
     "activities":{"cooking":3},
     "sentences":[
       {"activity":"cooking","de":"Schneide die Zwiebel in kleine Stücke.","en":"Cut the onion into small pieces."},
     ]},
    {"id":"a2_n_reservierung","lemma":"Reservierung","article":"die","plural":"Reservierungen","pos":"noun","english":"reservation","level":"A2",
     "activities":{"restaurant":3,"hotel":3},
     "sentences":[
       {"activity":"restaurant","de":"Ich habe eine Reservierung auf den Namen Meier.","en":"I have a reservation under the name Meier."},
     ]},
    {"id":"a2_n_bedienung","lemma":"Bedienung","article":"die","plural":"Bedienungen","pos":"noun","english":"waiter/waitress; service","level":"A2",
     "activities":{"restaurant":3},
     "sentences":[
       {"activity":"restaurant","de":"Die Bedienung ist sehr freundlich.","en":"The service is very friendly."},
     ]},
    {"id":"a2_n_trinkgeld","lemma":"Trinkgeld","article":"das","plural":"Trinkgelder","pos":"noun","english":"tip","level":"A2",
     "activities":{"restaurant":3},
     "sentences":[
       {"activity":"restaurant","de":"Fünf Euro als Trinkgeld sind in Ordnung.","en":"Five euros as a tip is fine."},
     ]},
    {"id":"a2_n_schlange","lemma":"Schlange","article":"die","plural":"Schlangen","pos":"noun","english":"queue, line","level":"A2",
     "activities":{"shopping":2,"anmeldung":2,"transport":1},
     "sentences":[
       {"activity":"anmeldung","de":"Die Schlange am Bürgeramt ist sehr lang.","en":"The queue at the citizens' office is very long."},
     ]},
    {"id":"a2_n_frage","lemma":"Frage","article":"die","plural":"Fragen","pos":"noun","english":"question","level":"A2",
     "activities":{"work":2,"email":2,"anmeldung":1},
     "sentences":[
       {"activity":"email","de":"Ich habe eine Frage zu Ihrer letzten E-Mail.","en":"I have a question about your last email."},
     ]},
    {"id":"a2_n_nachricht","lemma":"Nachricht","article":"die","plural":"Nachrichten","pos":"noun","english":"message / news","level":"A2",
     "activities":{"news":3,"tech":2,"family":1},
     "sentences":[
       {"activity":"news","de":"Hast du die Nachrichten heute gelesen?","en":"Did you read the news today?"},
       {"activity":"tech","de":"Ich schicke dir eine Nachricht.","en":"I'll send you a message."},
     ]},
    {"id":"a2_a_schwierig","lemma":"schwierig","article":None,"plural":None,"pos":"adj","english":"difficult","level":"A2",
     "activities":{"work":2,"kids":2,"anmeldung":1},
     "sentences":[
       {"activity":"anmeldung","de":"Das Formular ist etwas schwierig.","en":"The form is a bit tricky."},
     ]},
    {"id":"a2_a_einfach","lemma":"einfach","article":None,"plural":None,"pos":"adj","english":"simple, easy","level":"A2",
     "activities":{"cooking":2,"tech":1,"work":1},
     "sentences":[
       {"activity":"cooking","de":"Das Rezept ist einfach, versprochen.","en":"The recipe is easy, I promise."},
     ]},
    {"id":"a2_n_meinung","lemma":"Meinung","article":"die","plural":"Meinungen","pos":"noun","english":"opinion","level":"A2",
     "activities":{"news":3,"smalltalk":2,"family":1},
     "sentences":[
       {"activity":"news","de":"Was ist deine Meinung dazu?","en":"What's your opinion on that?"},
     ]},
    {"id":"a2_v_glauben","lemma":"glauben","article":None,"plural":None,"pos":"verb","english":"to believe, think","level":"A2",
     "activities":{"smalltalk":2,"news":2,"family":1},
     "sentences":[
       {"activity":"smalltalk","de":"Ich glaube, es regnet gleich.","en":"I think it's about to rain."},
     ]},
    {"id":"a2_v_meinen","lemma":"meinen","article":None,"plural":None,"pos":"verb","english":"to mean, think","level":"A2",
     "activities":{"work":2,"family":1,"smalltalk":1},
     "sentences":[
       {"activity":"smalltalk","de":"Was meinst du damit?","en":"What do you mean by that?"},
     ]},
]


# ---------------------------- B1 ----------------------------

B1 = [
    {"id":"b1_n_wartezimmer","lemma":"Wartezimmer","article":"das","plural":"Wartezimmer","pos":"noun","english":"waiting room","level":"B1",
     "activities":{"doctor":3},
     "sentences":[
       {"activity":"doctor","de":"Im Wartezimmer sitzen schon fünf Leute.","en":"There are already five people in the waiting room."},
     ]},
    {"id":"b1_n_facharzt","lemma":"Facharzt","article":"der","plural":"Fachärzte","pos":"noun","english":"specialist (doctor)","level":"B1",
     "activities":{"doctor":3,"health_insurance":2},
     "sentences":[
       {"activity":"doctor","de":"Mein Hausarzt überweist mich an einen Facharzt.","en":"My GP is referring me to a specialist."},
     ]},
    {"id":"b1_n_nebenwirkung","lemma":"Nebenwirkung","article":"die","plural":"Nebenwirkungen","pos":"noun","english":"side effect","level":"B1",
     "activities":{"pharmacy":3,"doctor":2},
     "sentences":[
       {"activity":"pharmacy","de":"Welche Nebenwirkungen hat dieses Medikament?","en":"What side effects does this medication have?"},
     ]},
    {"id":"b1_n_dosierung","lemma":"Dosierung","article":"die","plural":"Dosierungen","pos":"noun","english":"dosage","level":"B1",
     "activities":{"pharmacy":3,"doctor":2},
     "sentences":[
       {"activity":"pharmacy","de":"Die Dosierung steht auf dem Beipackzettel.","en":"The dosage is on the information leaflet."},
     ]},
    {"id":"b1_n_zuzahlung","lemma":"Zuzahlung","article":"die","plural":"Zuzahlungen","pos":"noun","english":"co-payment","level":"B1",
     "activities":{"health_insurance":3,"pharmacy":2},
     "sentences":[
       {"activity":"pharmacy","de":"Die Zuzahlung beträgt fünf Euro.","en":"The co-payment is five euros."},
     ]},
    {"id":"b1_n_entgelt","lemma":"Entgelt","article":"das","plural":"Entgelte","pos":"noun","english":"compensation, fee","level":"B1",
     "activities":{"banking":3,"work":2},
     "sentences":[
       {"activity":"banking","de":"Für die Überweisung fällt ein Entgelt an.","en":"There's a fee for the transfer."},
     ]},
    {"id":"b1_v_kuendigen","lemma":"kündigen","article":None,"plural":None,"pos":"verb","english":"to cancel, give notice","level":"B1",
     "activities":{"tech":3,"flat_hunt":2,"work":2,"health_insurance":1},
     "sentences":[
       {"activity":"tech","de":"Ich möchte meinen Vertrag kündigen.","en":"I'd like to cancel my contract."},
       {"activity":"flat_hunt","de":"Wir müssen die Wohnung drei Monate vorher kündigen.","en":"We have to give three months' notice on the flat."},
     ]},
    {"id":"b1_n_kuendigung","lemma":"Kündigung","article":"die","plural":"Kündigungen","pos":"noun","english":"cancellation, notice","level":"B1",
     "activities":{"tech":3,"flat_hunt":2,"work":2},
     "sentences":[
       {"activity":"tech","de":"Die Kündigung muss schriftlich erfolgen.","en":"The cancellation must be made in writing."},
     ]},
    {"id":"b1_n_hausordnung","lemma":"Hausordnung","article":"die","plural":"Hausordnungen","pos":"noun","english":"house rules","level":"B1",
     "activities":{"landlord":3},
     "sentences":[
       {"activity":"landlord","de":"Die Hausordnung hängt im Treppenhaus.","en":"The house rules are posted in the stairwell."},
     ]},
    {"id":"b1_n_vermieterin","lemma":"Nachbarin","article":"die","plural":"Nachbarinnen","pos":"noun","english":"neighbor (f.)","level":"B1",
     "activities":{"landlord":2,"smalltalk":2},
     "sentences":[
       {"activity":"landlord","de":"Meine Nachbarin beschwert sich über den Lärm.","en":"My neighbor is complaining about the noise."},
     ]},
    {"id":"b1_v_beschweren","lemma":"sich beschweren","article":None,"plural":None,"pos":"verb","english":"to complain","level":"B1",
     "activities":{"landlord":2,"hotel":2,"restaurant":2,"news":1},
     "sentences":[
       {"activity":"hotel","de":"Ich möchte mich über das Zimmer beschweren.","en":"I'd like to complain about the room."},
     ]},
    {"id":"b1_v_erledigen","lemma":"erledigen","article":None,"plural":None,"pos":"verb","english":"to take care of, finish","level":"B1",
     "activities":{"work":3,"anmeldung":2,"email":1},
     "sentences":[
       {"activity":"work","de":"Ich muss noch zwei Dinge vor dem Meeting erledigen.","en":"I still need to take care of two things before the meeting."},
     ]},
    {"id":"b1_v_vereinbaren","lemma":"vereinbaren","article":None,"plural":None,"pos":"verb","english":"to arrange, agree","level":"B1",
     "activities":{"work":3,"doctor":2,"email":1},
     "sentences":[
       {"activity":"doctor","de":"Kann ich einen Termin für nächste Woche vereinbaren?","en":"Can I arrange an appointment for next week?"},
     ]},
    {"id":"b1_n_sprechstunde","lemma":"Sprechstunde","article":"die","plural":"Sprechstunden","pos":"noun","english":"consultation hour","level":"B1",
     "activities":{"doctor":3,"kids":2},
     "sentences":[
       {"activity":"doctor","de":"Die Sprechstunde ist von acht bis zwölf.","en":"Consultation hours are from eight to twelve."},
     ]},
    {"id":"b1_a_zustaendig","lemma":"zuständig","article":None,"plural":None,"pos":"adj","english":"responsible, in charge","level":"B1",
     "activities":{"anmeldung":3,"work":2,"health_insurance":2},
     "sentences":[
       {"activity":"anmeldung","de":"Wer ist für meinen Fall zuständig?","en":"Who is in charge of my case?"},
     ]},
    {"id":"b1_n_elternabend","lemma":"Elternabend","article":"der","plural":"Elternabende","pos":"noun","english":"parents' evening","level":"B1",
     "activities":{"kids":3},
     "sentences":[
       {"activity":"kids","de":"Nächsten Mittwoch ist Elternabend.","en":"Parents' evening is next Wednesday."},
     ]},
    {"id":"b1_v_bewerben2","lemma":"empfehlen","article":None,"plural":None,"pos":"verb","english":"to recommend","level":"B1",
     "activities":{"restaurant":3,"travel":2,"hobbies":2,"news":1},
     "sentences":[
       {"activity":"restaurant","de":"Was können Sie uns empfehlen?","en":"What would you recommend?"},
       {"activity":"travel","de":"Welchen Weg können Sie empfehlen?","en":"Which route would you recommend?"},
     ]},
    {"id":"b1_n_schlagzeile","lemma":"Schlagzeile","article":"die","plural":"Schlagzeilen","pos":"noun","english":"headline","level":"B1",
     "activities":{"news":3},
     "sentences":[
       {"activity":"news","de":"Diese Schlagzeile ist heute überall.","en":"This headline is everywhere today."},
     ]},
    {"id":"b1_n_umfrage","lemma":"Umfrage","article":"die","plural":"Umfragen","pos":"noun","english":"survey, poll","level":"B1",
     "activities":{"news":3,"work":1},
     "sentences":[
       {"activity":"news","de":"Die Umfrage zeigt eine klare Mehrheit.","en":"The poll shows a clear majority."},
     ]},
    {"id":"b1_v_sich_verlieben","lemma":"sich verlieben","article":None,"plural":None,"pos":"verb","english":"to fall in love","level":"B1",
     "activities":{"dating":3,"family":1},
     "sentences":[
       {"activity":"dating","de":"Ich habe mich sofort in sie verliebt.","en":"I fell in love with her right away."},
     ]},
    {"id":"b1_v_sich_treffen","lemma":"sich treffen","article":None,"plural":None,"pos":"verb","english":"to meet (up)","level":"B1",
     "activities":{"dating":3,"family":2,"smalltalk":2,"hobbies":1},
     "sentences":[
       {"activity":"dating","de":"Wollen wir uns am Freitag treffen?","en":"Shall we meet up on Friday?"},
     ]},
]


ALL_WORDS = A1 + A2 + B1
