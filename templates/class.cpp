#undef _USE_MATH_DEFINES
#define _USE_MATH_DEFINES
#include <algorithm>
#include <cmath>
#include <iostream>
#include <list>
#include <numeric>
#include <map>
#include <set>
#include <sstream>
#include <string>
#include <vector>

using namespace std;

class $CLASSNAME$ {

public:
	$RC$ $METHODNAME$($METHODPARMS$) {
		$RC$ result;


		return result;
	}

	void run_test(string s);
};

// BEGIN CUT HERE
template<typename T> T parse(const string &s, int &pos) {
	T x; if (pos >= s.length()) return x;
	size_t len = 0, e;
	if (s[pos] == '\"') { ++pos; e = s.find('\"', pos);
		if (e == string::npos) return x;
		len = e - pos; stringstream ss(s.substr(pos, len));
		ss >> x; ++len;
	} else {
		len = s.length() - pos; e = s.find_first_of(",\"}", pos);
		if (e != string::npos) len = e - pos;
		stringstream ss(s.substr(pos, len)); ss >> x;
	}
	pos += len; if (pos < s.length() && s[pos] == ',') ++pos;
	while (pos < s.length() && s[pos] == ' ') ++pos;
	return x;
}
template<> string parse(const string &s, int &pos) {
	string x; if (pos >= s.length()) return x;
	size_t len = 0, e;
	if (s[pos] != '\"') return x;
	e = s.find('\"', ++pos); if (e == string::npos) return x;
	len = e - pos;
	x = s.substr(pos, len);
	pos += (len + 1);
	if (pos < s.length() && s[pos] == ',') ++pos;
	while (pos < s.length() && s[pos] == ' ') ++pos;
	return x;
}
template<typename T> vector<T> parse_array(const string &s, int &pos) {
	vector<T> v; if (pos >= s.length()) return v;
	bool q = s[pos] == '\"'; pos += q;
	if (pos >= s.length() || s[pos] != '{') return v;
	++pos;
	while (pos < s.length()) {
		if (s[pos] == ' ') { ++pos; continue; }
		if (s[pos] == '}') { ++pos; break; }
		v.push_back(parse<T>(s, pos));
	}
	if (pos < s.length() && s[pos] == '\"' && q) ++pos;
	if (pos < s.length() && s[pos] == ',') ++pos;
	while (pos < s.length() && s[pos] == ' ') ++pos;
	return v;
}
template<typename T> void output(const T &x) { cout << x; }
void output(const string &x) { cout << "\"" << x << "\""; }
template<typename T> void output_array(const vector<T> &res) {
	typename vector<T>::const_iterator it;
	cout << "{";
	for (it = res.begin(); it != res.end(); ++it) {
		if (it != res.begin()) cout << ", ";
		output(*it);
	}
	cout << "}";
}

void $CLASSNAME$::run_test(string s) {$TESTCODE$}

// BEGIN CUT HERE
int main() {
	cout.rdbuf()->pubsetbuf(NULL, 0);
	cout.setf(ios::fixed, ios::floatfield);
	cout.precision(10);
	string s;
	$CLASSNAME$ ___test;
	while (getline(cin, s)) {
		___test.run_test(s);
	}
	return 0;
}
// END CUT HERE
