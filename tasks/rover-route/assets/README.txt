route-a.png and route-b.png show the two routes on the NASA Mars Trek layer
"MRO CTX, Jezero Mosaic, Preliminary".

They are made by tools/make-pictures.html from the coordinates in
tools/route-paths.json. To rebuild them:

  python tasks/rover-route/tools/save_server.py
  then open http://127.0.0.1:8137/tasks/rover-route/tools/make-pictures.html
  and press Save.
