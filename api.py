from datetime import date
import flask
from flask import request, jsonify
import sqlite3
import subprocess
import json
import os
import shutil

app = flask.Flask(__name__)
app.config["DEBUG"] = True
signalDB=os.path.expanduser('~') + "/Desktop/signal.db"
signalMessageFile=os.path.expanduser('~') + "/Desktop/signalMessages"
automaticMessageRetrieveFile=os.path.expanduser('~') + "/Desktop/automaticMessageRetrieve.sh"

def jsonDictionary(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d


@app.route('/', methods=['GET'])
def home():
    return '''<h1>Testing Signal API</h1>
<p>This is a Signal API for ThunderBird Addon</p>'''


# Get All Contacts
@app.route('/api/v1/resources/contacts/all', methods=['GET'])
# http://signal.api:5000/api/v1/resources/contacts/all?phoneNumber=%2b14382252412
def contacts_all():
	query_parameters = request.args
	phoneNumber = query_parameters.get('phoneNumber')
	recipient_file = os.path.expanduser('~') + "/.local/share/signal-cli/data/"+phoneNumber+".d/recipients-store"
	
	#opening JSON file
	file = open(recipient_file)
	data = json.load(file)
	response = flask.jsonify(data)
	response.headers.add('Access-Control-Allow-Origin','*')
	return (response)

@app.route('/api/v1/resources/contacts/update', methods=['GET'])
# http://signal.api:5000/api/v1/resources/contacts/update?phoneNumber=%2b14382252412
def updateContacts():
	query_parameters = request.args
	phoneNumber = query_parameters.get('phoneNumber')
	subprocess.run(['signal-cli', '-u', phoneNumber, 'receive'], stdout=subprocess.PIPE)
	
	response = flask.jsonify({"phoneNumber":phoneNumber})
	response.headers.add('Access-Control-Allow-Origin','*')
	return response
	
@app.route('/api/v1/resources/logout', methods=['GET'])
def logout():
	query_parameters = request.args
	phoneNumber = query_parameters.get('phoneNumber')
	file1 = os.path.expanduser('~') + "/.local/share/signal-cli/data/"+phoneNumber
	dir1 = os.path.expanduser('~') + "/.local/share/signal-cli/data/"+phoneNumber+".d"
	
	os.remove(file1)
	shutil.rmtree(dir1)
	
	response = flask.jsonify({"phoneNumber":phoneNumber})
	response.headers.add('Access-Control-Allow-Origin','*')
	return response

@app.route('/api/v1/resources/verifyIfInSignal', methods=['GET'])
# http://signal.api:5000/api/v1/resources/verifyIfInSignal?user=%2b14382252412&verify=%2b14382252412
def verify_if_the_number_is_in_Signal():
    query_parameters = request.args
    user = query_parameters.get('user')
    phone = query_parameters.get('verify')
    result = subprocess.run(
        ['signal-cli', '-u', user, 'getUserStatus', phone], stdout=subprocess.PIPE)
    response=flask.jsonify({"status":str(result.stdout)[2:-3]})# b'+14382252412: true\n' -->  +14382252412: true
    response.headers.add('Access-Control-Allow-Origin','*')
    return response 

@app.route('/api/v1/resources/getRegisteredPhoneNumber', methods=['GET'])
#signal.api:5000/api/v1/resources/getRegisteredPhoneNumber
def getRegisteredPhoneNumber():
    ps_process = subprocess.Popen(['ls', os.path.expanduser('~') + '/.local/share/signal-cli/data/'], stdout=subprocess.PIPE)    
    grep_process = subprocess.Popen(["grep","-v", "d"], stdin=ps_process.stdout, stdout=subprocess.PIPE)
    ps_process.stdout.close()  # Allow ps_process to receive a SIGPIPE if grep_process exits.
    output = grep_process.communicate()[0]
    print("Registered Number is "+str(output)[2:-3])
    response = flask.jsonify({"phoneNumber":str(output)[2:-3]}) #   b'+14382252412\n' -->  +14382252412
    response.headers.add('Access-Control-Allow-Origin','*')
    return response
    
@app.errorhandler(404)
def page_not_found(e):
    return "<h1>404</h1><p>The resource could not be found.</br>"+e+"</p>", 404

# Get details of the hash including password and sender

@app.route('/api/v1/resources/getPasswordOfHash', methods=['GET'])
#To save all the message with "SignalEncrypted" in desktop
#while true; do echo '{"jsonrpc":"2.0","method":"receive"}' | signal-cli -u `ls ~/.local/share/signal-cli/data/ | grep -v d` jsonRpc 
#| grep SignalEncrypted | grep dataMessage >> ~/.local/share/signal-cli/data/`ls ~/.local/share/signal-cli/data/ | grep -v d`.d/signalMessages ; cat ~/.local/share/signal-cli/data/`ls ~/.local/share/signal-cli/data/ | grep -v d`.d/signalMessages | grep message; sleep 60; done;
#signal.api:5000/api/v1/resources/getPasswordOfHash?hash=hash11
def getPassFromHash():
    query_parameters = request.args
    hash = query_parameters.get('hash')
    
    query = "SELECT * FROM hashTable WHERE"
    to_filter = []

    if hash:
        query += ' hash=? AND'
        to_filter.append(hash)
    if not (hash ):#or sentDate or senderPhone):
        error="""
        Please Enter the hash in query...
        eg, signal.api:5000/api/v1/resources/getPasswordOfHash?hash=somehash
        """
        return page_not_found(error)
    query = query[:-4] + ';'

    results = findPasswordFromDB(query, to_filter)
    
    if results == "":
    	writeSignalMessagetoFile()
    	saveHashFromSignalMessages()
    	results = findPasswordFromDB(query, to_filter)
    
    response=flask.jsonify(results)
    response.headers.add('Access-Control-Allow-Origin','*')
    return response
    
# searching DB for the correct password    
def findPasswordFromDB(query, to_filter):
	conn = sqlite3.connect(signalDB)
	conn.row_factory = jsonDictionary
	cur = conn.cursor()
	results = cur.execute(query, to_filter).fetchall()
	
	try:
		return results[0]
	except IndexError:
		return ""
    
# Send Message to the number
@app.route('/api/v1/resources/sendMessage', methods=['GET'])
# http://signal.api:5000/api/v1/resources/sendMessage?hash=hashShiva&senderPhone=%2b14382252412&receiverPhone=%2b14382252412&password=shivaPassword&sentDate=%222021-21-22%22
def send_message():
    query_parameters = request.args
    hashValue = query_parameters.get('hash')
    sentDate = query_parameters.get('sentDate')  # insertCurrentDate
    senderPhone = query_parameters.get('senderPhone')
    receiverPhone = query_parameters.get('receiverPhone')
    password = query_parameters.get('password')
    
    # Send Message
    message = "###SignalEncrypted###\nID: " + hashValue + "\nSender: " + senderPhone + "\nReceiver: " + receiverPhone + "\nPassword: " + password + "\nDate & Time: " + sentDate
    # message="###SignalEncrypted###"
    print(message)
    result = subprocess.run(['signal-cli', '-u', senderPhone, 'send','-m', message, receiverPhone], stdout=subprocess.PIPE)

    saveHashToDB(hashValue,password)
    response=flask.jsonify({"status":"done"})
    response.headers.add('Access-Control-Allow-Origin','*')
    return response

def writeSignalMessagetoFile():
    result = subprocess.run(['sh', automaticMessageRetrieveFile], stdout=subprocess.PIPE)
    

def saveHashFromSignalMessages():
    file = open(signalMessageFile, 'r')
    lines = file.readlines()
    for line in lines:
        # print(line)
        dictLine=json.loads(line)
        # print(dictLine)
        # message=dictLine["params"]["envelope"]["syncMessage"]["sentMessage"]["message"]
        message=dictLine["params"]["envelope"]["dataMessage"]["message"]
        chunks = message.split('\n')
        hash=chunks[1][6:]
        password=chunks[4][10:]
        saveHashToDB(hash,password)
    
def saveHashToDB(hash,password):
    # Save the hash
    conn = sqlite3.connect(signalDB)
    cur = conn.cursor()
    entry =cur.execute('SELECT * FROM hashTable WHERE (hash=?)', [hash]).fetchone()
    print(entry)
    if entry is None:
        results = cur.execute("insert into hashTable (hash,password) values (?,?)", (hash,password))
        conn.commit()
        print(f"({hash},{password}) inserted into database")
    else:
        print(f"({hash},{password}) already in database")
    cur.close()

@app.route('/api/v1/resources/linkDevice', methods=['GET'])
# http://signal.api:5000/api/v1/resources/linkDevice?deviceName=hello
def linkDevice():
    query_parameters = request.args
    deviceName = query_parameters.get('deviceName')
    subprocess.run(['xdg-open', r"signalcaptcha://link/"+deviceName], stdout=subprocess.PIPE)
    response = flask.jsonify({"deviceName":deviceName})
    response.headers.add('Access-Control-Allow-Origin','*')
    return response

app.run(host='signal.api', debug=True, port=5000)
# saveHashFromSignalMessages()

